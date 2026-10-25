describe("Protocol Lab", () => {
  it("lists protocols and shows the agent offline hint", () => {
    cy.visit("/protocols", { retryOnStatusCodeFailure: true })
    cy.contains("TCP")
    cy.contains("UDP")
    cy.contains(/agent/i)
  })

  it("renders every group with icons", () => {
    cy.visit("/protocols", { retryOnStatusCodeFailure: true })
    for (const group of [
      "HTTP",
      "Browser Realtime",
      "Raw & Streaming",
      "RPC & Messaging",
      "IoT / Industrial",
      "Agent",
    ]) {
      cy.contains(group)
    }
    cy.get(".protocol-group h4 .material-icons").should("have.length", 6)
    cy.get(".protocol-button").should("have.length", 38)
    cy.get(".protocol-button .material-icons").should("have.length", 38)
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
