"""Research prompt template for deep stock analysis."""

RESEARCH_SYSTEM_PROMPT = """You are a world-class financial analyst and research expert. Your task is to create comprehensive, well-researched investment reports on publicly traded stocks.

Your analysis should be:
- Thorough and data-driven
- Balanced (covering both opportunities and risks)
- Based on recent, factual information from web searches
- Written in clear, professional markdown format
- Properly cited with references

You have access to web search capabilities. Use them extensively (up to 50 searches) to gather:
- Recent news and press releases
- Financial data and metrics
- Industry trends and competitive landscape
- Analyst opinions and ratings
- Regulatory filings and earnings reports
- Market sentiment and social media discussions

Structure your report with these exact sections:
1. Company Overview
2. Financial Analysis
3. Market Sentiment & Positioning
4. Risks & Challenges
5. Opportunities & Catalysts
6. Investment Recommendation
7. References

Be thorough, objective, and actionable."""

def get_research_prompt(stock_symbol: str) -> str:
    """Generate the user prompt for stock research."""
    return f"""Conduct a comprehensive deep research report on {stock_symbol}.

**Instructions:**
1. Perform extensive web searches (up to 50) to gather the latest information about {stock_symbol}
2. Focus on data from the past 6-12 months for recent developments
3. Include specific numbers, dates, and metrics wherever possible
4. Cite all sources in the References section

**Required Sections:**

## 1. Company Overview
- Business model and main products/services
- Market position and competitive advantages
- Recent corporate developments (M&A, partnerships, leadership changes)
- Key executives and governance

## 2. Financial Analysis
- Revenue trends and growth rates (recent quarters/years)
- Profitability metrics (margins, EPS, ROE, etc.)
- Balance sheet health (debt levels, cash position)
- Cash flow analysis
- Valuation metrics (P/E, P/S, PEG, etc.)
- Comparison to industry peers

## 3. Market Sentiment & Positioning
- Current analyst ratings and price targets
- Institutional ownership and recent changes
- Market cap and trading volume trends
- Short interest and insider trading activity
- Social media and retail investor sentiment

## 4. Risks & Challenges
- Industry-specific risks
- Competitive threats
- Regulatory concerns
- Macro-economic factors
- Company-specific vulnerabilities
- Bear case scenarios

## 5. Opportunities & Catalysts
- Growth drivers and expansion plans
- New products or market opportunities
- Potential M&A or partnerships
- Industry tailwinds
- Bull case scenarios

## 6. Investment Recommendation
- Overall assessment (Buy/Hold/Sell)
- Investment score (0-100)
- Risk level (Low/Medium/High)
- Time horizon (Short/Medium/Long-term)
- Target price range (if applicable)
- Key metrics to monitor

## 7. References
List all sources used, formatted as:
- [Source Name](URL) - Brief description
- Include publication dates where relevant
- Organize by category (financial data, news, analyst reports, etc.)

**Guidelines:**
- Use markdown formatting (headers, bold, lists, tables)
- Include specific data points and quotes
- Be balanced - discuss both positives and negatives
- Avoid speculation - stick to factual information
- If information is unavailable or uncertain, state this clearly
- Use tables for financial comparisons where appropriate

Begin your research now. Search extensively before writing."""


def get_section_extraction_prompt(section_name: str, full_report: str) -> str:
    """Extract a specific section from the full report."""
    return f"""Extract only the "{section_name}" section from the following report.
Return just that section's content, preserving all markdown formatting.

Report:
{full_report}

Return only the {section_name} section content (including the header):"""
