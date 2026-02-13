from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models, schemas
from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/user", tags=["User Data"])

# ---------------- RECENT ----------------
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
    # Remove existing same tab (so it moves to top)
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


# ---------------- USAGE ----------------
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
    # We use same schema: payload.tab required, name ignored here
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


# ---------------- FAVOURITES ----------------
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


# ---------------- SUGGESTIONS (Suggestion Box) ----------------
@router.get("/suggestions", response_model=list[schemas.UserSuggestionOut])
def get_user_suggestions(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return (
        db.query(models.UserSuggestion)
        .filter(models.UserSuggestion.user_id == user.id)
        .order_by(models.UserSuggestion.created_at.desc())
        .limit(20)
        .all()
    )

@router.post("/suggestions", response_model=list[schemas.UserSuggestionOut])
def add_user_suggestion(payload: schemas.UserSuggestionCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = models.UserSuggestion(
        user_id=user.id,
        tool_idea=payload.toolIdea.strip(),
        note=(payload.note.strip() if payload.note else None),
    )
    db.add(row)
    db.commit()

    rows = (
        db.query(models.UserSuggestion)
        .filter(models.UserSuggestion.user_id == user.id)
        .order_by(models.UserSuggestion.created_at.desc())
        .all()
    )

    # keep only 20
    if len(rows) > 20:
        for r in rows[20:]:
            db.delete(r)
        db.commit()

    return (
        db.query(models.UserSuggestion)
        .filter(models.UserSuggestion.user_id == user.id)
        .order_by(models.UserSuggestion.created_at.desc())
        .limit(20)
        .all()
    )

@router.delete("/suggestions")
def clear_user_suggestions(db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.query(models.UserSuggestion).filter(models.UserSuggestion.user_id == user.id).delete()
    db.commit()
    return {"ok": True}