import { Lifecycle } from "@well-known-components/interfaces"

export type RunnerOptions<Components> = {
  main: (components: Components) => Promise<any>
  initComponents: () => Promise<Components>
}

export const createE2ERunner = <TestComponents>(options: RunnerOptions<TestComponents>) => {
  return (name: string, suite: (getComponents: () => TestComponents) => void) => {
    describe(name, () => {
      let program: Lifecycle.ComponentBasedProgram<TestComponents>

      before(async () => {
        program = await Lifecycle.programEntryPoint<TestComponents>(options)
      })

      function getComponents() {
        if (!program) throw new Error("Cannot get the components before the test program is initialized")
        const c = program.components
        if (!c) throw new Error("Cannot get the components")
        return c
      }

      suite(getComponents)

      after(async () => {
        if (program) {
          await program.stop()
        }
      })
    })
  }
}
