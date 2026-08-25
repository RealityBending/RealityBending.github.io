let profileActions = {
    open: null,
    openMinimal: null,
    openByFolder: null,
}

export function registerProfileActions(nextActions) {
    profileActions = {
        ...profileActions,
        ...nextActions,
    }
}

export function openProfile(profile) {
    profileActions.open?.(profile)
}

export function openMinimalProfile(profile) {
    profileActions.openMinimal?.(profile)
}

/* For callers that hold a folder slug rather than a member object — news
   bylines, which update_news.py resolves against the same manifest. The lookup
   is people.js's, because that is where the manifest lives; a caller that did
   it itself would be fetching a second copy. Silently does nothing until the
   manifest has landed, which is the same contract as the other two. */
export function openProfileByFolder(folder) {
    profileActions.openByFolder?.(folder)
}
