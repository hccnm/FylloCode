## MODIFIED Requirements

### Requirement: Welcome page provides action buttons

The system SHALL display a single "Open Folder" action button below the brand identity.

#### Scenario: Action button is visible

- **WHEN** the Welcome content is displayed
- **THEN** an "Open Folder" button is shown
- **AND** the "Open Folder" button is styled as a primary solid button
- **AND** the button has an icon on the left side
- **AND** no "Create Project" button is displayed

## REMOVED Requirements

### Requirement: Welcome page shows two side-by-side action buttons

**Reason**: The "Create Project" functionality is being removed from the application.

**Migration**: Users should use the "Open Folder" button to open an existing directory instead.

### Requirement: Create Project button opens modal

**Reason**: The "Create Project" functionality is being removed from the application.

**Migration**: N/A — the Create Project modal is being deleted entirely.
