# backend/routers/user_data.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

import models, schemas
from database import get_db
from routers.auth import get_current_user  # user auth dependency

router = APIRouter(prefix="/user", tags=["User Data"])

# --------------------------- Helpers ---------------------------

def _enrich_suggestions(db: Session, viewer_user_id: int, rows: list[models.UserSuggestion]):
    """
    Return suggestions with aggregated likes, viewer's liked flag,
    author info (user_name, user_email) and status/admin_note.
    """
    if not rows:
        return []

    ids = [r.id for r in rows]

    # Like counts per suggestion
    counts = dict(
        db.query(
            models.UserSuggestionLike.suggestion_id,
            func.count(models.UserSuggestionLike.id)
        )
        .filter(models.UserSuggestionLike.suggestion_id.in_(ids))
        .group_by(models.UserSuggestionLike.suggestion_id)
        .all()
    )

    # Which suggestions are liked by the viewer
    liked_ids = set(
        sid for (sid,) in db.query(models.UserSuggestionLike.suggestion_id)
            .filter(
                models.UserSuggestionLike.suggestion_id.in_(ids),
                models.UserSuggestionLike.user_id == viewer_user_id
            )
            .all()
    )

    # Users cache (author info)
    user_ids = list({r.user_id for r in rows})
    users_map = {
        u.id: (u.name, u.email)
        for u in db.query(models.User).filter(models.User.id.in_(user_ids)).all()
    }

    enriched = []
    for r in rows:
        # ✅ FIX: define uname/uemail properly
        uname, uemail = users_map.get(r.user_id, (None, None))

        enriched.append({
            "id": r.id,
            "tool_idea": r.tool_idea,
            "note": r.note,
            "created_at": r.created_at,
            "likes": int(counts.get(r.id, 0)),
            "liked_by_me": (r.id in liked_ids),

            # Extended fields
            "status": r.status or "pending",
            "admin_note": r.admin_note,
            "user_name": uname,
            "user_email": uemail,
        })

    # Sort by likes desc, created_at desc
    enriched.sort(key=lambda x: (x["likes"], x["created_at"]), reverse=True)
    return enriched

# --------------------------- RECENT ---------------------------

@router.get("/recent", response_model=list[schemas.RecentOut])
def get_recent(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = (
        db.query(models.UserRecentActivity)
        .filter(models.UserRecentActivity.user_id == user.id)
        .order_by(models.UserRecentActivity.created_at.desc())
        .limit(5)
        .all()
    )
    return rows

@router.post("/recent", response_model=list[schemas.RecentOut])
def add_recent(payload: schemas.RecentCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Remove existing same tab (move to top)
    db.query(models.UserRecentActivity).filter(
        models.UserRecentActivity.user_id == user.id,
        models.UserRecentActivity.tab == payload.tab
    ).delete()

    row = models.UserRecentActivity(user_id=user.id, tab=payload.tab, name=payload.name)
    db.add(row)
    db.commit()

    # Keep only last 5
    rows = (
        db.query(models.UserRecentActivity)
        .filter(models.UserRecentActivity.user_id == user.id)
        .order_by(models.UserRecentActivity.created_at.desc())
        .all()
    )
    if len(rows) > 5:
        for r in rows[5:]:
            db.delete(r)
        db.commit()

    return (
        db.query(models.UserRecentActivity)
        .filter(models.UserRecentActivity.user_id == user.id)
        .order_by(models.UserRecentActivity.created_at.desc())
        .limit(5)
        .all()
    )

@router.delete("/recent")
def clear_recent(db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.query(models.UserRecentActivity).filter(models.UserRecentActivity.user_id == user.id).delete()
    db.commit()
    return {"ok": True}

# --------------------------- USAGE ---------------------------

@router.get("/usage", response_model=list[schemas.UsageOut])
def get_usage(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = (
        db.query(models.UserToolUsage)
        .filter(models.UserToolUsage.user_id == user.id)
        .order_by(models.UserToolUsage.count.desc())
        .limit(50)
        .all()
    )
    return rows

@router.post("/usage")
def bump_usage(payload: schemas.RecentCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Same schema: payload.tab required; payload.name ignored here
    row = (
        db.query(models.UserToolUsage)
        .filter(models.UserToolUsage.user_id == user.id, models.UserToolUsage.tab == payload.tab)
        .first()
    )
    if row:
        row.count += 1
    else:
        row = models.UserToolUsage(user_id=user.id, tab=payload.tab, count=1)
        db.add(row)
    db.commit()
    return {"ok": True}

@router.delete("/usage")
def clear_usage(db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.query(models.UserToolUsage).filter(models.UserToolUsage.user_id == user.id).delete()
    db.commit()
    return {"ok": True}

# --------------------------- FAVOURITES ---------------------------

@router.get("/favourites", response_model=list[schemas.FavouriteOut])
def get_favourites(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return (
        db.query(models.UserFavourite)
        .filter(models.UserFavourite.user_id == user.id)
        .order_by(models.UserFavourite.created_at.desc())
        .all()
    )

@router.post("/favourites", response_model=list[schemas.FavouriteOut])
def toggle_favourite(payload: schemas.FavouriteCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    existing = db.query(models.UserFavourite).filter(
        models.UserFavourite.user_id == user.id,
        models.UserFavourite.tab == payload.tab
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
    else:
        row = models.UserFavourite(user_id=user.id, tab=payload.tab, name=payload.name, icon=payload.icon)
        db.add(row)
        db.commit()

    return (
        db.query(models.UserFavourite)
        .filter(models.UserFavourite.user_id == user.id)
        .order_by(models.UserFavourite.created_at.desc())
        .all()
    )

# --------------------------- SUGGESTIONS (per user) ---------------------------

@router.get("/suggestions", response_model=list[schemas.UserSuggestionOut])
def get_user_suggestions(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = (
        db.query(models.UserSuggestion)
        .filter(models.UserSuggestion.user_id == user.id)
        .order_by(models.UserSuggestion.created_at.desc())
        .limit(20)
        .all()
    )
    return _enrich_suggestions(db, user.id, rows)

# --------------------------- PUBLIC SUGGESTIONS ---------------------------

@router.get("/suggestions/all", response_model=list[schemas.UserSuggestionOut])
def get_all_suggestions(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = (
        db.query(models.UserSuggestion)
        .order_by(models.UserSuggestion.created_at.desc())
        .limit(200)
        .all()
    )
    return _enrich_suggestions(db, user.id, rows)

@router.post("/suggestions", response_model=list[schemas.UserSuggestionOut])
def add_user_suggestion(payload: schemas.UserSuggestionCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    idea = (payload.toolIdea or "").strip()
    if not idea:
        raise HTTPException(status_code=400, detail="toolIdea is required")

    row = models.UserSuggestion(
        user_id=user.id,
        tool_idea=idea,
        note=(payload.note.strip() if payload.note else None),
    )
    db.add(row)
    db.commit()

    # Keep only 20 latest per user
    rows = (
        db.query(models.UserSuggestion)
        .filter(models.UserSuggestion.user_id == user.id)
        .order_by(models.UserSuggestion.created_at.desc())
        .all()
    )
    if len(rows) > 20:
        for r in rows[20:]:
            db.delete(r)
        db.commit()

    rows = (
        db.query(models.UserSuggestion)
        .filter(models.UserSuggestion.user_id == user.id)
        .order_by(models.UserSuggestion.created_at.desc())
        .limit(20)
        .all()
    )
    return _enrich_suggestions(db, user.id, rows)

# Like toggle (per suggestion/user)
@router.post("/suggestions/{sid}/like", response_model=schemas.SuggestionLikeToggleOut)
def toggle_user_suggestion_like(sid: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    s = db.query(models.UserSuggestion).filter(models.UserSuggestion.id == sid).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    like = db.query(models.UserSuggestionLike).filter(
        models.UserSuggestionLike.suggestion_id == sid,
        models.UserSuggestionLike.user_id == user.id
    ).first()

    if like:
        db.delete(like)
        db.commit()
        liked = False
    else:
        db.add(models.UserSuggestionLike(suggestion_id=sid, user_id=user.id))
        db.commit()
        liked = True

    count = db.query(func.count(models.UserSuggestionLike.id))\
              .filter(models.UserSuggestionLike.suggestion_id == sid)\
              .scalar() or 0

    return {"id": sid, "likes": int(count), "liked_by_me": liked}

# ------------------ DELETE SINGLE SUGGESTION (USER ONLY) ------------------
@router.delete("/suggestions/{sid}")
def delete_user_suggestion(sid: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = (
        db.query(models.UserSuggestion)
        .filter(
            models.UserSuggestion.id == sid,
            models.UserSuggestion.user_id == user.id
        )
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="Suggestion not found or not yours")

    db.query(models.UserSuggestionLike).filter(
        models.UserSuggestionLike.suggestion_id == sid
    ).delete()

    db.delete(row)
    db.commit()

    return {"ok": True, "deleted_id": sid}