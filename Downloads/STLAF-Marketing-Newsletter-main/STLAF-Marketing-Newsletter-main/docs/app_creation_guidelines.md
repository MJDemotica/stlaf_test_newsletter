<!--
File: app_creation_guidelines.md
Author: AI Assistant
Date: 2026-06-09
Purpose: System and app-wide development instructions and guidelines
-->

# App Creation Guidelines

These are instructions every developer must follow when creating, maintaining, and testing our app. Follow them strictly to ensure quality, readability, and maintainability.

## Coder’s Notes
Every file must start with a comment block:
File 
Author and date
Purpose
Example:
```javascript
//
// File: user_auth.ts
// Author: Juan Dela Cruz
// Date: 2026-05-15
// Purpose: Handles user login and session management
//
```
Add inline comments for tricky logic

## Project Structure
All project files should be organized clearly. Keep your source code inside a `src` folder, with separate subfolders for models (data models), controllers (business logic), views (UI templates or frontend), utils (helper functions), and services (external APIs or integrations). Place all unit and integration tests in a `tests` folder, documentation in a `docs` folder, configuration files in a `config` folder, and images, fonts, or other media in an `assets` folder. This structure keeps the project organized, makes it easy to find files, and helps the team work efficiently.

## Error Handling
Indicate a list of possible issues your web application might encounter, such as null values, database connection failures, invalid user inputs, missing files, or API request errors, and provide solutions for each. Always handle exceptions, validate inputs, check resources before use, and log errors clearly so the system is easier to debug and maintain.
- Always log errors using structured logging (INFO, WARN, ERROR).
- Do not leave unhandled exceptions—every potential failure must be handled.
