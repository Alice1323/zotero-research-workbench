# External connectors stay lawful and generic

v0.3 exposed only a generic External Literature Connector boundary for approved or user-supplied literature sources, and did not ship, recommend, test, document, or special-case connectors for Blocked Literature Sources. This kept discovery extensible while avoiding source-specific support for unauthorized access, copyright-infringing download, credential misuse, or unstable scraping.

Superseded for PDF acquisition by `docs/superpowers/plans/2026-05-25-pdf-acquisition-baseline.md`: user-configured Sci-Hub and analogous third-party PDF resolvers are supported when provenance is visible and every attachment write passes the User Confirmation Gate.
