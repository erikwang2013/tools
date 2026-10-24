describe("Protocol Lab", () => {
  it("lists protocols and shows the agent offline hint", () => {
    cy.visit("/protocols", { retryOnStatusCodeFailure: true })
    cy.contains("TCP")
    cy.contains("UDP")
    cy.contains(/agent/i)
  })

  it("selects a protocol and renders its fields", () => {
    cy.visit("/protocols", { retryOnStatusCodeFailure: true })
    cy.contains("TCP").click()
    cy.get("input").should("have.length.at.least", 2)
  })

  it("shows the local agent section in settings", () => {
    cy.visit("/settings")
    cy.contains(/local agent/i)
    cy.get('input[type="password"]').should("have.length.at.least", 1)
  })
})
