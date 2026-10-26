describe("Visit Home", () => {
  it('Have a page title with "Postwoman"', () => {
    cy.visit("/", { retryOnStatusCodeFailure: true })
      .get("title")
      .should("contain", "Postwoman")
  })

  it("renders the default Chinese locale", () => {
    cy.visit("/", { retryOnStatusCodeFailure: true })
    cy.contains("发送").should("be.visible")
  })

  it("sandboxes the HTML preview iframe", () => {
    cy.clearLocalStorage()
    cy.server()
    cy.route({
      method: "GET",
      url: "http://example.test/html",
      response: "<html><body>preview</body></html>",
      headers: { "content-type": "text/html" },
    }).as("request")

    cy.visit("/?url=http%3A%2F%2Fexample.test&path=%2Fhtml", {
      retryOnStatusCodeFailure: true,
    })
      .get("#send")
      .click()
    cy.wait("@request")
    cy.get("iframe.covers-response").should("have.attr", "sandbox")
  })
})
