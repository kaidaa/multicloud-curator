from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.duplicates.models import DuplicateGroup, DuplicateGroupMember
from app.features.files_visibility.models import File
from app.features.scan_metadata import repository as scan_metadata_repo
from app.features.scan_metadata.schemas import ScanCoverageResponse

DUPLICATES_SCAN_TYPE = "duplicates_scan"


@dataclass(slots=True)
class FileWithAccount:
    file: File
    account: Account


@dataclass(slots=True)
class DuplicateGroupWithMembers:
    group: DuplicateGroup
    members: list[FileWithAccount]


def list_files_for_scan(db: Session) -> list[File]:
    return list(
        db.execute(
            select(File)
            .join(Account, File.account_id == Account.id)
            .where(
                File.trashed.is_(False),
                File.is_folder.is_(False),
            )
        )
        .scalars()
        .all()
    )


def list_file_rows_for_scan(
    db: Session,
    *,
    account_ids: set[str] | None = None,
) -> list[FileWithAccount]:
    if account_ids is not None and not account_ids:
        return []
    stmt = (
        select(File, Account)
        .join(Account, File.account_id == Account.id)
        .where(
            File.trashed.is_(False),
            File.is_folder.is_(False),
        )
    )
    if account_ids is not None:
        stmt = stmt.where(File.account_id.in_(account_ids))
    rows = db.execute(
        stmt
    ).all()
    return [FileWithAccount(file=row[0], account=row[1]) for row in rows]


def replace_duplicate_groups(
    db: Session,
    *,
    groups: list[tuple[str, list[File]]],
    scanned_at: datetime,
    coverage: ScanCoverageResponse | None = None,
) -> None:
    db.execute(delete(DuplicateGroupMember))
    db.execute(delete(DuplicateGroup))
    for match_basis, members in groups:
        group = DuplicateGroup(
            representative_name=pick_representative_name(members),
            match_basis=match_basis,
            total_size_bytes=sum(file.size_bytes or 0 for file in members),
            members_count=len(members),
            scanned_at=scanned_at,
        )
        db.add(group)
        db.flush()
        for file in sorted(members, key=lambda item: (item.file_name.casefold(), item.id)):
            db.add(DuplicateGroupMember(group_id=group.id, file_id=file.id))
    if coverage is not None:
        scan_metadata_repo.replace_scan_metadata(
            db,
            scan_type=DUPLICATES_SCAN_TYPE,
            scan_at=scanned_at,
            coverage=coverage,
        )
    db.commit()


def pick_representative_name(members: list[File]) -> str:
    ordered = sorted(members, key=lambda item: (not item.is_owned, item.file_name.casefold(), item.id))
    return ordered[0].file_name


def latest_scan_at(db: Session) -> datetime | None:
    metadata = scan_metadata_repo.get_latest_scan_metadata(
        db,
        scan_type=DUPLICATES_SCAN_TYPE,
    )
    if metadata is not None:
        return metadata.scan_at
    return db.execute(select(func.max(DuplicateGroup.scanned_at))).scalar_one()


def latest_scan_coverage(db: Session) -> ScanCoverageResponse | None:
    metadata = scan_metadata_repo.get_latest_scan_metadata(
        db,
        scan_type=DUPLICATES_SCAN_TYPE,
    )
    return scan_metadata_repo.coverage_response(metadata)


def list_duplicate_groups(db: Session) -> list[DuplicateGroupWithMembers]:
    groups = list(
        db.execute(
            select(DuplicateGroup).order_by(DuplicateGroup.total_size_bytes.desc(), DuplicateGroup.id)
        )
        .scalars()
        .all()
    )
    result: list[DuplicateGroupWithMembers] = []
    for group in groups:
        rows = db.execute(
            select(File, Account)
            .join(DuplicateGroupMember, DuplicateGroupMember.file_id == File.id)
            .join(Account, File.account_id == Account.id)
            .where(DuplicateGroupMember.group_id == group.id)
            .order_by(File.file_name, File.id)
        ).all()
        result.append(
            DuplicateGroupWithMembers(
                group=group,
                members=[FileWithAccount(file=row[0], account=row[1]) for row in rows],
            )
        )
    return result


def get_file_with_account(db: Session, file_id: str) -> FileWithAccount | None:
    row = db.execute(
        select(File, Account)
        .join(Account, File.account_id == Account.id)
        .where(File.id == file_id)
    ).first()
    if row is None:
        return None
    return FileWithAccount(file=row[0], account=row[1])


def delete_file_row(db: Session, file: File) -> None:
    db.delete(file)
    db.commit()


def cleanup_duplicate_groups(db: Session) -> None:
    groups = list(db.execute(select(DuplicateGroup)).scalars().all())
    for group in groups:
        files = list(
            db.execute(
                select(File)
                .join(DuplicateGroupMember, DuplicateGroupMember.file_id == File.id)
                .where(DuplicateGroupMember.group_id == group.id)
            )
            .scalars()
            .all()
        )
        if len(files) < 2:
            db.delete(group)
            continue
        group.members_count = len(files)
        group.total_size_bytes = sum(file.size_bytes or 0 for file in files)
        group.representative_name = pick_representative_name(files)
    db.commit()
