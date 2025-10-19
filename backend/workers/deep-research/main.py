"""Deep research worker - generates comprehensive stock analysis reports."""

import os
import time
import json
import re
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from openai import OpenAI
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import sys
sys.path.insert(0, "../../shared")
from shared.models.research import ResearchReport
from shared.redis_stream import publish_research_update
from research_prompt import RESEARCH_SYSTEM_PROMPT, get_research_prompt

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "10"))


def decrypt_api_key(encrypted_text: str) -> str:
    """Decrypt the user's API key using AES-256-CBC."""
    if not ENCRYPTION_KEY:
        raise ValueError("ENCRYPTION_KEY not set in environment")

    # Parse the encrypted format: "iv:encrypted_data"
    parts = encrypted_text.split(":")
    if len(parts) != 2:
        raise ValueError("Invalid encrypted key format")

    iv = bytes.fromhex(parts[0])
    encrypted_data = bytes.fromhex(parts[1])

    # Get the encryption key (first 32 bytes of the hex string)
    key = bytes.fromhex(ENCRYPTION_KEY[:64])

    # Decrypt
    cipher = AES.new(key, AES.MODE_CBC, iv)
    decrypted = unpad(cipher.decrypt(encrypted_data), AES.block_size)

    return decrypted.decode("utf-8")


def get_user_api_key(db: Session, user_id: str) -> str:
    """Fetch and decrypt the user's OpenAI API key from the database."""
    result = db.execute(
        text("SELECT encrypted_key FROM user_api_keys WHERE user_id = :user_id"),
        {"user_id": user_id}
    ).fetchone()

    if not result:
        raise ValueError(f"No API key found for user {user_id}")

    encrypted_key = result[0]
    return decrypt_api_key(encrypted_key)

# Section markers for parsing
SECTION_MARKERS = {
    "overview": "## 1. World Context",  # Changed to World Context
    "financials": "## 2. The Macro Thesis",  # Repurposed for Macro Thesis
    "sentiment": "## 6. Research Process",  # Repurposed for Research Process
    "risks": "## 4. What Could Go Wrong",
    "opportunities": "## 3. Catalysts & Opportunities",
    "recommendation": "## 5. The Verdict",
    "references": "## 7. Sources"
}


def extract_section(full_text: str, section_name: str) -> str:
    """Extract a specific section from the full report."""
    marker = SECTION_MARKERS.get(section_name)
    if not marker or not marker:  # Skip empty markers
        return ""

    # Find the section start
    start_idx = full_text.find(marker)
    if start_idx == -1:
        return ""

    # Find the next section header (any ## followed by number)
    # This will match the next numbered section header
    import re
    # Look for the next section header after this one
    next_section_pattern = r'\n## \d+\.'
    match = re.search(next_section_pattern, full_text[start_idx + len(marker):])

    if match:
        end_idx = start_idx + len(marker) + match.start()
    else:
        end_idx = len(full_text)

    return full_text[start_idx:end_idx].strip()


def extract_recommendation_data(recommendation_section: str) -> dict:
    """Extract structured data from the recommendation section."""
    data = {
        "recommendation": None,
        "investment_score": None,
        "risk_level": None,
        "time_horizon": None,
        "target_price": None
    }

    # Extract recommendation (Buy/Hold/Sell)
    rec_match = re.search(r'(Buy|Hold|Sell)', recommendation_section, re.IGNORECASE)
    if rec_match:
        data["recommendation"] = rec_match.group(1).lower()

    # Extract investment score
    score_match = re.search(r'(?:Investment Score|Score)[:\s]+(\d+)(?:/100)?', recommendation_section, re.IGNORECASE)
    if score_match:
        data["investment_score"] = float(score_match.group(1))

    # Extract risk level
    risk_match = re.search(r'Risk Level[:\s]+(Low|Medium|High)', recommendation_section, re.IGNORECASE)
    if risk_match:
        data["risk_level"] = risk_match.group(1).lower()

    # Extract time horizon
    horizon_match = re.search(r'Time Horizon[:\s]+(Short|Medium|Long)', recommendation_section, re.IGNORECASE)
    if horizon_match:
        data["time_horizon"] = horizon_match.group(1).lower()

    # Extract target price
    price_match = re.search(r'Target Price[:\s]+\$?([\d,]+(?:\.\d{2})?)', recommendation_section, re.IGNORECASE)
    if price_match:
        price_str = price_match.group(1).replace(',', '')
        data["target_price"] = float(price_str)

    return data


def generate_research_report(report: ResearchReport, db: Session):
    """Generate a comprehensive research report using OpenAI with web search."""
    try:
        start_time = time.time()

        # Update status to generating
        report.status = "generating"
        report.started_at = datetime.utcnow()
        report.progress_percentage = 0
        db.commit()

        publish_research_update(report.id, {
            "type": "progress",
            "message": f"Starting research on {report.stock_symbol}...",
            "percentage": 0
        })

        # Fetch the user's API key
        try:
            user_api_key = get_user_api_key(db, report.user_id)
            print(f"Using user's API key for report {report.id}")
        except ValueError as e:
            raise ValueError(f"Cannot generate report: {str(e)}")

        # Create OpenAI client with user's API key
        client = OpenAI(api_key=user_api_key)

        # Generate the report using OpenAI with streaming
        print(f"Generating research report for {report.stock_symbol}...")

        messages = [
            {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
            {"role": "user", "content": get_research_prompt(report.stock_symbol)}
        ]

        # Call OpenAI with web search capabilities
        full_report = ""
        last_percentage = 0

        # Using OpenAI's experimental web search API
        # This uses the newer responses.create API with web_search tool
        try:
            response = client.responses.create(
                model="gpt-4o",
                tools=[{"type": "web_search"}],
                input=messages,
                stream=True,
                # Optional: Configure web search parameters
                extra_body={
                    "web": {
                        "recency_days": 180,  # Focus on last 6 months
                        "max_results": 50,
                        "domain_filter": [
                            "sec.gov",
                            "reuters.com",
                            "seekingalpha.com",
                            "barrons.com",
                            "marketwatch.com",
                            "cnbc.com",
                            "investorplace.com",
                            "fool.com",
                            "bloomberg.com",
                            "wsj.com",
                            "finance.yahoo.com",
                            "morningstar.com",
                            "investors.com"
                        ]
                    }
                }
            )

            for chunk in response:
                # Handle different chunk types from responses API
                if hasattr(chunk, 'delta') and hasattr(chunk.delta, 'content'):
                    content = chunk.delta.content
                    if content:
                        full_report += content

                        # Estimate progress based on content length
                        estimated_percentage = min(int((len(full_report) / 3500) * 90), 90)

                        if estimated_percentage > last_percentage:
                            last_percentage = estimated_percentage
                            report.progress_percentage = estimated_percentage
                            db.commit()

                            publish_research_update(report.id, {
                                "type": "progress",
                                "message": "Generating report...",
                                "percentage": estimated_percentage,
                                "content_preview": full_report[:500]
                            })

        except (AttributeError, TypeError, Exception) as e:
            # Fallback to standard chat completion if responses API not available
            print(f"Web search API not available ({type(e).__name__}: {str(e)}), falling back to standard completion")
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                stream=True,
                temperature=0.7,
                max_tokens=4000
            )

            for chunk in response:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_report += content

                    estimated_percentage = min(int((len(full_report) / 3500) * 90), 90)

                    if estimated_percentage > last_percentage:
                        last_percentage = estimated_percentage
                        report.progress_percentage = estimated_percentage
                        db.commit()

                        publish_research_update(report.id, {
                            "type": "progress",
                            "message": "Generating report...",
                            "percentage": estimated_percentage,
                            "content_preview": full_report[:500]
                        })

        # Parse the full report into sections
        print("Parsing report sections...")
        report.progress_percentage = 92
        db.commit()

        publish_research_update(report.id, {
            "type": "progress",
            "message": "Parsing report sections...",
            "percentage": 92
        })

        # Extract each section
        sections = {}
        for section_key in SECTION_MARKERS.keys():
            section_content = extract_section(full_report, section_key)
            sections[section_key] = section_content

            # Update database
            setattr(report, f"section_{section_key}", section_content)

            # Publish section update
            publish_research_update(report.id, {
                "type": "section",
                "section": section_key,
                "content": section_content
            })

        # Extract structured data from recommendation section
        rec_data = extract_recommendation_data(sections.get("recommendation", ""))
        report.recommendation = rec_data.get("recommendation")
        report.investment_score = rec_data.get("investment_score")
        report.risk_level = rec_data.get("risk_level")
        report.time_horizon = rec_data.get("time_horizon")
        report.target_price = rec_data.get("target_price")

        # Store full report
        report.full_report = full_report

        # Generate executive summary (first 500 characters of overview + recommendation)
        overview_text = sections.get("overview", "")
        rec_text = sections.get("recommendation", "")
        exec_summary = f"{overview_text[:300]}...\n\n{rec_text[:200]}..."
        report.executive_summary = exec_summary

        # Extract key findings (look for bullet points in the report)
        key_findings = []
        for line in full_report.split('\n'):
            if line.strip().startswith('- ') or line.strip().startswith('* '):
                finding = line.strip()[2:].strip()
                if len(finding) > 20 and len(finding) < 200:
                    key_findings.append(finding)
                if len(key_findings) >= 10:
                    break

        report.key_findings = json.dumps(key_findings)

        # Mark as completed
        processing_time = int(time.time() - start_time)
        report.status = "completed"
        report.progress_percentage = 100
        report.processing_time_seconds = processing_time
        report.completed_at = datetime.utcnow()
        db.commit()

        publish_research_update(report.id, {
            "type": "complete",
            "message": f"Research report completed in {processing_time}s",
            "percentage": 100,
            "report_id": report.id
        })

        print(f"Report completed in {processing_time}s")

    except Exception as e:
        print(f"Error generating report: {str(e)}")
        report.status = "failed"
        report.error_message = str(e)
        db.commit()

        publish_research_update(report.id, {
            "type": "error",
            "message": f"Failed to generate report: {str(e)}",
            "percentage": report.progress_percentage
        })


def process_pending_reports(db: Session):
    """Check for pending research reports and process them."""
    pending_reports = db.query(ResearchReport).filter(
        ResearchReport.status == "pending"
    ).order_by(ResearchReport.created_at).all()

    for report in pending_reports:
        print(f"Processing report {report.id} for {report.stock_symbol}")
        generate_research_report(report, db)


def main():
    """Main worker loop."""
    print("Deep Research Worker starting...")
    print(f"Polling interval: {POLL_INTERVAL_SECONDS}s")

    if not ENCRYPTION_KEY:
        print("ERROR: ENCRYPTION_KEY not set!")
        return

    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

    while True:
        try:
            with Session(engine) as db:
                process_pending_reports(db)
        except Exception as e:
            print(f"Error in main loop: {str(e)}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
