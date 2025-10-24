"""Admin API routes for AI prompt management."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_db
import sys

sys.path.insert(0, "../shared")
from shared.models.ai_prompt import AIPrompt
from shared.models.reddit_post import RedditPost, RedditComment
from shared.ai_analysis import (
    get_openai_client,
    render_prompt_template,
    score_comment_quality,
    COMMENT_SCORING_MODEL,
)

router = APIRouter(prefix="/api/admin/prompts", tags=["admin", "prompts"])


# Pydantic schemas for request/response
class PromptCreate(BaseModel):
    prompt_type: str  # "comment_scoring", "post_analysis", "cross_post_synthesis"
    version: int
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: str
    user_prompt_template: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.3
    max_tokens: Optional[int] = None
    created_by: Optional[str] = None
    notes: Optional[str] = None


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    user_prompt_template: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    notes: Optional[str] = None


class PromptResponse(BaseModel):
    id: int
    prompt_type: str
    version: int
    name: Optional[str]
    description: Optional[str]
    is_active: bool
    system_prompt: str
    user_prompt_template: str
    model: str
    temperature: float
    max_tokens: Optional[int]
    avg_cost_per_call: Optional[float]
    total_calls: int
    total_cost: float
    avg_tokens_used: Optional[int]
    success_rate: Optional[float]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class TestPromptRequest(BaseModel):
    system_prompt: str
    user_prompt_template: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.3
    sample_post_id: Optional[str] = None  # Optional: use specific post for testing
    sample_comment_id: Optional[str] = None  # Optional: use specific comment for testing


class TestPromptResponse(BaseModel):
    rendered_prompt: str
    ai_response: dict
    tokens_used: int
    cost_estimate: float


@router.get("/", response_model=List[PromptResponse])
async def list_prompts(
    prompt_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all AI prompts with optional filtering."""
    query = select(AIPrompt)

    if prompt_type:
        query = query.where(AIPrompt.prompt_type == prompt_type)
    if is_active is not None:
        query = query.where(AIPrompt.is_active == is_active)

    query = query.order_by(AIPrompt.prompt_type, AIPrompt.version.desc())

    result = await db.execute(query)
    prompts = result.scalars().all()

    return prompts


@router.get("/{prompt_id}", response_model=PromptResponse)
async def get_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific prompt by ID."""
    result = await db.execute(select(AIPrompt).where(AIPrompt.id == prompt_id))
    prompt = result.scalars().first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    return prompt


@router.post("/", response_model=PromptResponse)
async def create_prompt(prompt_data: PromptCreate, db: AsyncSession = Depends(get_db)):
    """Create a new AI prompt."""
    # Create new prompt
    new_prompt = AIPrompt(
        prompt_type=prompt_data.prompt_type,
        version=prompt_data.version,
        name=prompt_data.name,
        description=prompt_data.description,
        system_prompt=prompt_data.system_prompt,
        user_prompt_template=prompt_data.user_prompt_template,
        model=prompt_data.model,
        temperature=prompt_data.temperature,
        max_tokens=prompt_data.max_tokens,
        created_by=prompt_data.created_by,
        notes=prompt_data.notes,
        is_active=False,  # New prompts start inactive
        total_calls=0,
        total_cost=0.0,
    )

    db.add(new_prompt)
    await db.commit()
    await db.refresh(new_prompt)

    return new_prompt


@router.put("/{prompt_id}", response_model=PromptResponse)
async def update_prompt(
    prompt_id: int, prompt_data: PromptUpdate, db: AsyncSession = Depends(get_db)
):
    """Update an existing prompt."""
    result = await db.execute(select(AIPrompt).where(AIPrompt.id == prompt_id))
    prompt = result.scalars().first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Update fields
    update_data = prompt_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prompt, field, value)

    await db.commit()
    await db.refresh(prompt)

    return prompt


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a prompt."""
    result = await db.execute(select(AIPrompt).where(AIPrompt.id == prompt_id))
    prompt = result.scalars().first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    if prompt.is_active:
        raise HTTPException(
            status_code=400, detail="Cannot delete active prompt. Deactivate it first."
        )

    await db.delete(prompt)
    await db.commit()

    return {"message": "Prompt deleted successfully"}


@router.post("/{prompt_id}/activate")
async def activate_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    """Activate a prompt (deactivates all other prompts of the same type)."""
    result = await db.execute(select(AIPrompt).where(AIPrompt.id == prompt_id))
    prompt = result.scalars().first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Deactivate all other prompts of the same type
    await db.execute(
        update(AIPrompt)
        .where(AIPrompt.prompt_type == prompt.prompt_type)
        .values(is_active=False)
    )

    # Activate this prompt
    prompt.is_active = True
    await db.commit()
    await db.refresh(prompt)

    return {"message": f"Prompt {prompt_id} activated successfully", "prompt": prompt}


@router.post("/{prompt_id}/deactivate")
async def deactivate_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    """Deactivate a prompt."""
    result = await db.execute(select(AIPrompt).where(AIPrompt.id == prompt_id))
    prompt = result.scalars().first()

    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    prompt.is_active = False
    await db.commit()
    await db.refresh(prompt)

    return {"message": f"Prompt {prompt_id} deactivated successfully"}


@router.post("/test", response_model=TestPromptResponse)
async def test_prompt(test_data: TestPromptRequest, db: AsyncSession = Depends(get_db)):
    """Test a prompt with sample data before saving it."""
    # Get sample post and comment
    if test_data.sample_post_id:
        post_result = await db.execute(
            select(RedditPost).where(RedditPost.id == test_data.sample_post_id)
        )
        sample_post = post_result.scalars().first()
    else:
        # Get a random recent post with comments
        post_result = await db.execute(
            select(RedditPost)
            .where(RedditPost.num_comments > 0)
            .order_by(RedditPost.posted_at.desc())
            .limit(1)
        )
        sample_post = post_result.scalars().first()

    if not sample_post:
        raise HTTPException(status_code=404, detail="No sample post found")

    if test_data.sample_comment_id:
        comment_result = await db.execute(
            select(RedditComment).where(RedditComment.id == test_data.sample_comment_id)
        )
        sample_comment = comment_result.scalars().first()
    else:
        # Get a random comment from the post
        comment_result = await db.execute(
            select(RedditComment)
            .where(RedditComment.post_id == sample_post.id)
            .order_by(RedditComment.score.desc())
            .limit(1)
        )
        sample_comment = comment_result.scalars().first()

    if not sample_comment:
        raise HTTPException(status_code=404, detail="No sample comment found")

    # Render the user prompt template
    context = {
        "post": {
            "title": sample_post.title,
            "content": sample_post.content or "(No content)",
            "primary_stock": sample_post.primary_stock or "Unknown",
            "score": sample_post.score,
            "num_comments": sample_post.num_comments,
        },
        "comment": {
            "author": sample_comment.author,
            "content": sample_comment.content,
            "score": sample_comment.score,
        },
    }

    rendered_user_prompt = render_prompt_template(
        test_data.user_prompt_template, context
    )

    # Call OpenAI API
    client = get_openai_client()
    response = client.chat.completions.create(
        model=test_data.model,
        messages=[
            {"role": "system", "content": test_data.system_prompt},
            {"role": "user", "content": rendered_user_prompt},
        ],
        temperature=test_data.temperature,
        response_format={"type": "json_object"},
    )

    # Parse response
    import json

    ai_response = json.loads(response.choices[0].message.content)

    # Calculate cost
    from shared.ai_analysis import estimate_cost

    cost = estimate_cost(
        test_data.model, response.usage.prompt_tokens, response.usage.completion_tokens
    )

    return TestPromptResponse(
        rendered_prompt=rendered_user_prompt,
        ai_response=ai_response,
        tokens_used=response.usage.total_tokens,
        cost_estimate=cost,
    )
