/**
 * injections/bridge.cjs — subscribing the conversation's event log to the registry.
 */
const { injectionSettingsOf } = require('./state.cjs')
const { registerInjectionDefinition } = require('./view.cjs')

/**
 * Keep one registered Definition in step with the setting.
 *
 * Registering and unregistering — rather than registering once and answering "off" from
 * `match` — is what makes the switch take effect on a transcript that is already open:
 * the registry notifies the conversation engine, and the engine rebuilds every binding
 * from the Definitions in force.
 */
function createInjectionBridge(ctx, conversation) {
  let disposeDefinition = null
  return {
    sync() {
      const injectionSettings = injectionSettingsOf()
      if (injectionSettings.show && disposeDefinition === null) {
        disposeDefinition = registerInjectionDefinition(ctx, conversation)
      } else if (!injectionSettings.show && disposeDefinition !== null) {
        disposeDefinition()
        disposeDefinition = null
      }
    },
    dispose() {
      if (disposeDefinition === null) return
      disposeDefinition()
      disposeDefinition = null
    },
  }
}

module.exports = { createInjectionBridge }
