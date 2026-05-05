## MODIFIED Requirements

### Requirement: Application pages require a current project

The system SHALL prevent access to project-scoped application routes when no current project is selected by rendering WelcomeView instead.

#### Scenario: Project-scoped route without project

- **WHEN** the user navigates directly to `/chat`, `/pipeline`, `/integration`, `/proposal`, or `/proposal/:id` without a current project
- **THEN** the application renders the WelcomeView in the main content region
