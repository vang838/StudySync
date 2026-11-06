
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.schemas.contracts import SetInput, SetOut, RatingInput

from src.db.models import (
    Course,
    User,
    utcnow,
    UserCourseSave,
    FlashcardSets,
    Flashcard,
    FlashcardStudyProgress
)
from src.db.session import get_db
# Match the existing course APIs' user_id contract until app-wide sessions exist.
def get_current_user(user_id: int = Query(gt=0), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    return user


router = APIRouter(
    prefix="/flashcard-sets",
    tags=["flashcards"]
)


def owned_set(db: Session, set_id: int, user_id: int):
    result = db.scalar(
        select(FlashcardSets)
        .options(selectinload(FlashcardSets.cards))
        .where(
            FlashcardSets.flashcardsets_id == set_id,
            FlashcardSets.user_id == user_id
        )
    )

    if result is None:
        raise HTTPException(404, "Flashcard set not found")

    return result


def check_course(db: Session, course_id: str, user_id: int):
    exists = db.scalar(
        select(UserCourseSave.id).where(
            UserCourseSave.course_id == course_id,
            UserCourseSave.user_id == user_id,
            UserCourseSave.is_archived.is_(False)
        )
    )

    if exists is None:
        raise HTTPException(
            400, "Select a course saved to your account"
        )


def save_cards(db: Session, obj: FlashcardSets, cards):
    existing = {card.flashcard_id: card for card in obj.cards}
    submitted_ids = [card.flashcard_id for card in cards if card.flashcard_id is not None]
    if len(submitted_ids) != len(set(submitted_ids)) or any(
        card_id not in existing for card_id in submitted_ids
    ):
        raise HTTPException(400, "Card IDs must be unique and belong to this set")

    ordered = []
    for position, draft in enumerate(cards):
        card = existing[draft.flashcard_id] if draft.flashcard_id is not None else Flashcard()
        card.question = draft.question
        card.answer = draft.answer
        card.position = position
        ordered.append(card)
    obj.cards = ordered
    obj.updated_at = utcnow()


@router.get("/courses")
def my_courses(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    rows = db.execute(
        select(Course.course_id, Course.title)
        .join(
            UserCourseSave,
            Course.course_id == UserCourseSave.course_id
        )
        .where(
            UserCourseSave.user_id == user.user_id,
            UserCourseSave.is_archived.is_(False)
        )
        .order_by(Course.title)
    ).all()

    return [
        {"course_id": r.course_id, "title": r.title}
        for r in rows
    ]


@router.get("", response_model=list[SetOut])
def list_sets(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return db.scalars(
        select(FlashcardSets)
        .options(selectinload(FlashcardSets.cards))
        .where(FlashcardSets.user_id == user.user_id)
        .order_by(FlashcardSets.updated_at.desc())
    ).all()


@router.post("", response_model=SetOut, status_code=201)
def create_set(
    payload: SetInput,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    check_course(db, payload.course_id, user.user_id)

    obj = FlashcardSets(
        user_id=user.user_id,
        course_id=payload.course_id,
        title=payload.title.strip(),
        description=payload.description
    )

    db.add(obj)
    save_cards(db, obj, payload.cards)
    db.commit()

    return owned_set(db, obj.flashcardsets_id, user.user_id)


@router.get("/{set_id}", response_model=SetOut)
def get_set(
    set_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    return owned_set(db, set_id, user.user_id)


@router.put("/{set_id}", response_model=SetOut)
def update_set(
    set_id: int,
    payload: SetInput,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    obj = owned_set(db, set_id, user.user_id)
    check_course(db, payload.course_id, user.user_id)

    obj.course_id = payload.course_id
    obj.title = payload.title.strip()
    obj.description = payload.description

    save_cards(db, obj, payload.cards)
    db.commit()

    return owned_set(db, set_id, user.user_id)


@router.delete("/{set_id}", status_code=204)
def delete_set(
    set_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    db.delete(owned_set(db, set_id, user.user_id))
    db.commit()


@router.put("/{set_id}/cards/{card_id}/rating")
def rate_card(
    set_id: int,
    card_id: int,
    payload: RatingInput,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    obj = owned_set(db, set_id, user.user_id)

    if not any(
        card.flashcard_id == card_id for card in obj.cards
    ):
        raise HTTPException(404, "Card not found")

    progress = db.scalar(
        select(FlashcardStudyProgress).where(
            FlashcardStudyProgress.user_id == user.user_id,
            FlashcardStudyProgress.flashcard_id == card_id
        )
    )

    if progress is None:
        progress = FlashcardStudyProgress(
            user_id=user.user_id,
            flashcard_id=card_id,
            rating=payload.rating,
            last_reviewed_at=utcnow()
        )
        db.add(progress)
    else:
        progress.rating = payload.rating
        progress.last_reviewed_at = utcnow()

    db.commit()

    return {
        "flashcard_id": card_id,
        "rating": payload.rating
    }
