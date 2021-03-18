import expect from "expect"
import { TestComponents } from "../../src/types"
import { describeE2E } from "../harness/test-components-http-server"
import { describeTestE2E } from "../harness/test-components-mock"

describeE2E("integration sanity tests using a real server backend", integrationSuite)
describeTestE2E("integration sanity tests using mocked test server", integrationSuite)

function integrationSuite(getComponents: () => TestComponents) {
  it("responds /v1/transactions/0x1234563902c59f04f218384d80c951b412341231", async () => {
    const { fetcher: {fetch} } = getComponents()

    const r = await fetch("/v1/transactions/0x1234563902c59f04f218384d80c951b412341231")

    expect(r.status).toEqual(200)
    expect(await r.text()).toEqual("/ping")
  })
}
