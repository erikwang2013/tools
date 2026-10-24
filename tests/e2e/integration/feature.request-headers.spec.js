const lowerCaseHeaders = headers => {
  const result = {}
  Object.keys(headers).forEach(key => {
    result[key.toLowerCase()] = headers[key]
  })
  return result
}

describe("Request headers", () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.server()
  })

  it("sends the Bearer token and an automatic JSON Content-Type", () => {
    cy.route({
      method: "POST",
      url: "http://example.test/echo",
      response: { ok: true },
    }).as("request")

    cy.visit(
      "/?url=http%3A%2F%2Fexample.test&path=%2Fecho&method=POST&auth=Bearer%20Token&bearerToken=test-token",
      { retryOnStatusCodeFailure: true }
    )
      .get("#send")
      .click()

    cy.wait("@request").then(xhr => {
      const headers = lowerCaseHeaders(xhr.request.headers)
      expect(headers.authorization).to.equal("Bearer test-token")
      expect(headers["content-type"]).to.contain("application/json")
    })
  })

  it("does not persist auth secrets in localStorage", () => {
    cy.visit(
      "/?url=http%3A%2F%2Fexample.test&path=%2Fget&auth=Bearer%20Token&bearerToken=secret-token",
      { retryOnStatusCodeFailure: true }
    )
    cy.window().should(win => {
      expect(win.localStorage.getItem("vuex")).to.be.a("string")
      expect(win.localStorage.getItem("vuex")).not.to.contain("secret-token")
    })
  })

  it("keeps a user-supplied header", () => {
    cy.route({
      method: "GET",
      url: "http://example.test/echo",
      response: {},
    }).as("request")

    cy.visit(
      "/?url=http%3A%2F%2Fexample.test&path=%2Fecho&headers=" +
        encodeURIComponent('[{"key":"X-Test","value":"yes"}]'),
      { retryOnStatusCodeFailure: true }
    )
      .get("#send")
      .click()

    cy.wait("@request").then(xhr => {
      expect(lowerCaseHeaders(xhr.request.headers)["x-test"]).to.equal("yes")
    })
  })
})
