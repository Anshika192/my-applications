from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    category = Column(String(50))
    icon = Column(String(255))
    status = Column(String(20), default="active")
    url = Column(String(255))

class Suggestion(Base):
    __tablename__ = "suggestions"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    votes = relationship("Vote", back_populates="suggestion", cascade="all, delete-orphan")

class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True, index=True)
    suggestion_id = Column(Integer, ForeignKey("suggestions.id"), index=True, nullable=False)
    user_id = Column(String(36), index=True, nullable=False)  # UUID or any user identifier
    vote_type = Column(String(4), nullable=False)  # 'up' | 'down'

    suggestion = relationship("Suggestion", back_populates="votes")

    __table_args__ = (
        UniqueConstraint("suggestion_id", "user_id", name="uq_vote_suggestion_user"),
    )

# ✅ Naya model PDF save ke liye
class PdfFile(Base):
    __tablename__ = "pdf_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), unique=True, nullable=False)
    content = Column(Text, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())


# ✅ NEW: USER MODEL for Login/Signup
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ✅ Recent activity per user
class UserRecentActivity(Base):
    __tablename__ = "user_recent_activity"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    tab = Column(String(80), nullable=False)
    name = Column(String(120), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "tab", name="uq_recent_user_tab"),
    )


# ✅ Usage count per user per tool
class UserToolUsage(Base):
    __tablename__ = "user_tool_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    tab = Column(String(80), nullable=False)
    count = Column(Integer, default=0, nullable=False)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "tab", name="uq_usage_user_tab"),
    )


# ✅ Favourites per user
class UserFavourite(Base):
    __tablename__ = "user_favourites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    tab = Column(String(80), nullable=False)
    name = Column(String(120), nullable=False)
    icon = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "tab", name="uq_fav_user_tab"),
    )


# ✅ Suggestion Box (tool idea) per user
class UserSuggestion(Base):
    __tablename__ = "user_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    tool_idea = Column(String(255), nullable=False)
    note = Column(String(1000), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)



class MomRecord(Base):
    __tablename__ = "mom_records"
    id = Column(Integer, primary_key=True, index=True)
    mode = Column(String(20), default="AI")     # "AI" or "Classic"
    transcript = Column(Text, nullable=False)
    mom = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

