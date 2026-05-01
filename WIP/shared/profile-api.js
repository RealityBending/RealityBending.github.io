let profileActions = {
    open: null,
    openMinimal: null,
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
