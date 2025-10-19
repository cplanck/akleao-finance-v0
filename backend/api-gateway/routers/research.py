"""Research API routes for generating and retrieving stock research reports."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from database import get_db
import sys
import json
import asyncio
sys.path.insert(0, "../shared")
from shared.models.research import ResearchReport
from shared.models.stock import Stock
from shared.redis_stream import subscribe_to_research, get_research_history

router = APIRouter(prefix="/api/research", tags=["research"])


class GenerateReportRequest(BaseModel):
    """Request to generate a research report."""
    stock_symbol: str
    report_type: str = "deep_dive"
    user_id: str  # Provided by Next.js API route after session validation


class ReportResponse(BaseModel):
    """Research report response."""
    id: int
    stock_symbol: str
    report_type: str
    status: str
    progress_percentage: int
    current_section: Optional[str]
    title: str
    executive_summary: Optional[str]
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]
    processing_time_seconds: Optional[int]

    # Sections
    section_overview: Optional[str]
    section_financials: Optional[str]
    section_sentiment: Optional[str]
    section_risks: Optional[str]
    section_opportunities: Optional[str]
    section_recommendation: Optional[str]
    section_references: Optional[str]

    # Recommendations
    recommendation: Optional[str]
    investment_score: Optional[float]
    risk_level: Optional[str]
    time_horizon: Optional[str]
    target_price: Optional[float]

    error_message: Optional[str]


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    request: GenerateReportRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Queue a new research report generation.
    The worker will pick it up and start processing.

    Note: user_id is provided by the Next.js API route after session validation.
    """
    # Check if stock exists, if not create a placeholder
    stmt = select(Stock).where(Stock.symbol == request.stock_symbol.upper())
    result = await db.execute(stmt)
    stock = result.scalar_one_or_none()

    if not stock:
        # Create placeholder stock entry
        stock = Stock(
            symbol=request.stock_symbol.upper(),
            name=request.stock_symbol.upper(),
            sector=None,
            industry=None
        )
        db.add(stock)
        await db.flush()

    # Check if there's already a recent pending/generating report for this user
    recent_stmt = (
        select(ResearchReport)
        .where(ResearchReport.stock_symbol == request.stock_symbol.upper())
        .where(ResearchReport.user_id == request.user_id)
        .where(ResearchReport.status.in_(["pending", "generating"]))
        .order_by(desc(ResearchReport.created_at))
        .limit(1)
    )
    recent_result = await db.execute(recent_stmt)
    existing = recent_result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A report is already being generated for {request.stock_symbol}. Report ID: {existing.id}"
        )

    # Create new research report
    report = ResearchReport(
        user_id=request.user_id,
        stock_symbol=request.stock_symbol.upper(),
        report_type=request.report_type,
        title=f"Deep Research Report: {request.stock_symbol.upper()}",
        status="pending",
        progress_percentage=0
    )

    db.add(report)
    await db.commit()
    await db.refresh(report)

    return ReportResponse(
        id=report.id,
        stock_symbol=report.stock_symbol,
        report_type=report.report_type,
        status=report.status,
        progress_percentage=report.progress_percentage,
        current_section=report.current_section,
        title=report.title,
        executive_summary=report.executive_summary,
        created_at=report.created_at.isoformat() if report.created_at else None,
        started_at=report.started_at.isoformat() if report.started_at else None,
        completed_at=report.completed_at.isoformat() if report.completed_at else None,
        processing_time_seconds=report.processing_time_seconds,
        section_overview=report.section_overview,
        section_financials=report.section_financials,
        section_sentiment=report.section_sentiment,
        section_risks=report.section_risks,
        section_opportunities=report.section_opportunities,
        section_recommendation=report.section_recommendation,
        section_references=report.section_references,
        recommendation=report.recommendation,
        investment_score=report.investment_score,
        risk_level=report.risk_level,
        time_horizon=report.time_horizon,
        target_price=report.target_price,
        error_message=report.error_message
    )


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific research report by ID."""
    stmt = select(ResearchReport).where(ResearchReport.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return ReportResponse(
        id=report.id,
        stock_symbol=report.stock_symbol,
        report_type=report.report_type,
        status=report.status,
        progress_percentage=report.progress_percentage,
        current_section=report.current_section,
        title=report.title,
        executive_summary=report.executive_summary,
        created_at=report.created_at.isoformat() if report.created_at else None,
        started_at=report.started_at.isoformat() if report.started_at else None,
        completed_at=report.completed_at.isoformat() if report.completed_at else None,
        processing_time_seconds=report.processing_time_seconds,
        section_overview=report.section_overview,
        section_financials=report.section_financials,
        section_sentiment=report.section_sentiment,
        section_risks=report.section_risks,
        section_opportunities=report.section_opportunities,
        section_recommendation=report.section_recommendation,
        section_references=report.section_references,
        recommendation=report.recommendation,
        investment_score=report.investment_score,
        risk_level=report.risk_level,
        time_horizon=report.time_horizon,
        target_price=report.target_price,
        error_message=report.error_message
    )


@router.get("/list/{stock_symbol}")
async def list_reports(
    stock_symbol: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """List all research reports for a stock symbol."""
    stmt = (
        select(ResearchReport)
        .where(ResearchReport.stock_symbol == stock_symbol.upper())
        .order_by(desc(ResearchReport.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    reports = result.scalars().all()

    return {
        "stock_symbol": stock_symbol.upper(),
        "total": len(reports),
        "reports": [
            {
                "id": r.id,
                "status": r.status,
                "progress_percentage": r.progress_percentage,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "recommendation": r.recommendation,
                "investment_score": r.investment_score,
                "risk_level": r.risk_level
            }
            for r in reports
        ]
    }


@router.get("/stream/{report_id}")
async def stream_report_updates(report_id: int):
    """
    Server-Sent Events endpoint for streaming real-time report updates.
    Clients connect to this endpoint to receive progress updates.
    """
    async def event_generator():
        """Generate SSE events from Redis pub/sub."""
        # First, send historical updates if any
        try:
            history = get_research_history(report_id, limit=10)
            for update in reversed(history):  # Send in chronological order
                yield f"data: {json.dumps(update)}\n\n"
        except Exception as e:
            print(f"Error fetching history: {e}")

        # Then subscribe to real-time updates
        pubsub = subscribe_to_research(report_id)

        try:
            # Listen for new messages
            for message in pubsub.listen():
                if message['type'] == 'message':
                    yield f"data: {message['data']}\n\n"

                    # Parse the message to check if report is complete
                    try:
                        data = json.loads(message['data'])
                        if data.get('type') in ['complete', 'error']:
                            # Send final message and close connection
                            break
                    except:
                        pass

                # Send keep-alive ping every 15 seconds
                await asyncio.sleep(0.1)

        except Exception as e:
            print(f"Error in event stream: {e}")
        finally:
            pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.delete("/{report_id}")
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a research report."""
    stmt = select(ResearchReport).where(ResearchReport.id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await db.delete(report)
    await db.commit()

    return {"message": "Report deleted successfully", "id": report_id}
