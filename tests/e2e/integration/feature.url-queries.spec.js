describe("Authentication", () => {
  it(`Change default Auth username and password with URL`, () => {
    cy.visit(`?&auth=Basic Auth&httpUser=foo&httpPassword=bar`, { retryOnStatusCodeFailure: true })
      .get('input[name="http_basic_user"]', { timeout: 500 })
      .invoke("val")
      .then(user => {
        expect(user === "foo").to.equal(true)
      })

      .get('input[name="http_basic_passwd"]')
      .invoke("val")
      .then(pass => {
        expect(pass === "bar").to.equal(true)
      })
  })

  it("Enable username and password in URL with toggler", () => {
    cy.visit("/", { retryOnStatusCodeFailure: true })
      .get("#auth")
      .select("Basic Auth")
      .get('input[name="http_basic_user"]', { timeout: 500 })
      .type("foo")
      .get('input[name="http_basic_passwd"]', { timeout: 500 })
      .type("bar")
      .url()
      .should("not.contain", "foo")
      .should("not.contain", "bar")
      .get("#auth-url-toggle")
      .click()
      .url()
      .should("contain", "foo")
      .should("contain", "bar")
  })
})

describe("Shared URL safety", () => {
  beforeEach(() => {
    cy.clearLocalStorage()
  })

  it("ignores malformed shared headers instead of failing to mount", () => {
    cy.visit("/?headers=notjson", { retryOnStatusCodeFailure: true })
      .get("#url", { timeout: 2000 })
      .should("exist")
  })

  it("keeps headers out of the shared URL unless opted in", () => {
    cy.visit(
      "/?url=https%3A%2F%2Fexample.test&path=%2Fget&headers=" +
        encodeURIComponent('[{"key":"X-Secret","value":"s3cr3t"}]'),
      { retryOnStatusCodeFailure: true }
    )
    cy.location("search", { timeout: 5000 }).should("not.contain", "s3cr3t")
    cy.get("#headers-url-toggle").click({ force: true })
    cy.get("#url").type("x")
    cy.location("search", { timeout: 5000 }).should("contain", "s3cr3t")
  })

  it("does not execute a test script supplied in the URL", () => {
    cy.server()
    cy.route({
      method: "GET",
      url: "http://example.test/echo",
      response: { ok: true },
    }).as("request")

    cy.visit("/?url=http%3A%2F%2Fexample.test&path=%2Fecho&testScript=window.__pwned%3D1", {
      retryOnStatusCodeFailure: true,
    })
      .get("#send")
      .click()
    cy.wait("@request")
    cy.wait(100)
    cy.window().then(win => {
      expect(win.__pwned).to.be.undefined
    })
  })
})
