/**
 * shared/endpoints.cjs — every URL the half fetches, mirroring the Host half's route.
 */
const LIST_URL = '/dsh-custom-theme/themes'
const CSS_URL = (id) => `/dsh-custom-theme/theme/${encodeURIComponent(id)}.css`
const BACKGROUNDS_URL = '/dsh-custom-theme/backgrounds'
const BACKGROUND_URL = (name) => `/dsh-custom-theme/background/${encodeURIComponent(name)}`
const UPDATE_URL = '/dsh-custom-theme/update'
const UPDATE_CHECK_URL = '/dsh-custom-theme/update/check'
const UPDATE_APPLY_URL = '/dsh-custom-theme/update/apply'
const EFFORT_LEVELS_URL = '/dsh-custom-theme/effort-levels'

module.exports = { LIST_URL, CSS_URL, BACKGROUNDS_URL, BACKGROUND_URL, UPDATE_URL, UPDATE_CHECK_URL, UPDATE_APPLY_URL, EFFORT_LEVELS_URL }
