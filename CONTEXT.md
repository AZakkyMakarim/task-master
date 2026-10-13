# Task Manager

A multi-user to-do application where each user keeps their own tasks and can share individual tasks with other users.

## Language

### People

**User**:
A person with a registered account, identified by a unique email.
_Avoid_: Account, member

**Owner**:
The user who created a task. Only the owner can delete the task or manage its shares.
_Avoid_: Creator, author

**Recipient**:
A user a task has been shared with.
_Avoid_: Collaborator, guest, invitee

### Tasks

**Task**:
A unit of work with a title, belonging to exactly one owner.
_Avoid_: Todo, item, ticket

**Status**:
Where a task stands: todo, doing, or done. A task may move from any status to any other.
_Avoid_: State, stage

**Completed**:
A task whose status is done. It carries the moment it became done, and loses that moment if it leaves done.
_Avoid_: Finished, closed

**Priority**:
How important a task is: low, medium, or high. Medium unless stated otherwise.
_Avoid_: Urgency, importance

**Due date**:
The calendar day a task should be completed by. A day, not a moment in time.
_Avoid_: Deadline, due time

**Overdue**:
A task whose due date is before today and whose status is not done. A task due today is not overdue.
_Avoid_: Late, expired

**Archived task**:
A task that was completed more than 30 days ago and has been put away. It is hidden by default and read-only; it cannot be restored, only deleted by its owner.
_Avoid_: Deleted, hidden, closed

**Recurrence**:
A task's repetition setting: none, daily, or weekly. The rules for how a recurring task repeats are not yet decided.
_Avoid_: Repeat, schedule

### Sharing

**Share**:
A grant giving one recipient access to one task with a role. A task has at most one share per recipient; sharing again replaces the role.
_Avoid_: Invite, permission, access

**Role**:
What a share allows: view (read only) or edit (change any field of the task, but not delete it or manage its shares).
_Avoid_: Permission level, access level

**Revoke**:
The owner removing a share, ending the recipient's access.
_Avoid_: Unshare, remove access
