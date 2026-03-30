from pydantic import BaseModel, Field, EmailStr, AliasChoices
from typing import Optional
from datetime import datetime

# --- Applications ---
class ApplicationBase(BaseModel):
    name: str
    category: str
    icon: str
    url: str

class ApplicationCreate(ApplicationBase):
    status: Optional[str] = "active"

class ApplicationRead(ApplicationBase):
    id: int
    status: str

    class Config:
        from_attributes = True  # Pydantic v2


# --- Suggestions (public suggestion model) ---
class SuggestionBase(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)

class SuggestionCreate(SuggestionBase):
    pass

class SuggestionRead(SuggestionBase):
    id: int
    upvotes: int
    downvotes: int
    created_at: datetime

    class Config:
        from_attributes = True


# --- Voting ---
class VoteRequest(BaseModel):
    vote_type: str  # 'up' or 'down'
    user_id: str


# ✅ AUTH SCHEMAS
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Recent ---
class RecentCreate(BaseModel):
    tab: str
    name: str

class RecentOut(BaseModel):
    tab: str
    name: str
    created_at: datetime
    class Config:
        from_attributes = True


# --- Usage ---
class UsageOut(BaseModel):
    tab: str
    count: int
    class Config:
        from_attributes = True


# --- Favourites ---
class FavouriteCreate(BaseModel):
    tab: str
    name: str
    icon: Optional[str] = None

class FavouriteOut(FavouriteCreate):
    created_at: datetime
    class Config:
        from_attributes = True


# --- Suggestion Box (per-user) ---

class UserSuggestionCreate(BaseModel):
    """
    Frontend camelCase ke hisaab se `toolIdea` preferred hai.
    Lekin legacy/snake_case `tool_idea` bhi accept kar rahe hain using AliasChoices.
    """
    toolIdea: str = Field(
        min_length=1, max_length=255,
        validation_alias=AliasChoices("toolIdea", "tool_idea")
    )
    note: Optional[str] = Field(default=None, max_length=1000)

class UserSuggestionOut(BaseModel):
    id: int
    tool_idea: str
    note: Optional[str]
    created_at: datetime

    # ✅ Likes metadata
    likes: int = 0
    liked_by_me: bool = False

    # ✅ NEW: status & optional admin_note
    status: str = "pending"         # 'pending' | 'approved' | 'working' | 'rejected'
    admin_note: Optional[str] = None

    
 # ✅ NEW: author info
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    class Config:
        from_attributes = True


# ✅ NEW: Like toggle response
class SuggestionLikeToggleOut(BaseModel):
    id: int
    likes: int
    liked_by_me: bool