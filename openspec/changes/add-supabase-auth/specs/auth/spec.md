## ADDED Requirements

### Requirement: Public Student Access
The system SHALL allow visitors to use the student-facing `/client` experience without signing in and SHALL NOT create a Supabase anonymous user session by default.

#### Scenario: Visitor opens student app
- **WHEN** a visitor opens `/client` with no Supabase session
- **THEN** the student app renders normally
- **AND** no anonymous Supabase sign-in request is made automatically

### Requirement: Email Or Phone Password Authentication
The system SHALL provide Chinese login and registration UI for password-based authentication using either an email address or a phone number as the identifier.

#### Scenario: Register with email and nickname
- **WHEN** a visitor submits an email address, nickname, and password on the registration form
- **THEN** the system calls Supabase email/password sign-up
- **AND** creates a profile for the new user with the provided nickname and role `student`

#### Scenario: Register with phone and nickname
- **WHEN** a visitor submits a phone number, nickname, and password on the registration form and phone auth is enabled in Supabase
- **THEN** the system calls Supabase phone/password sign-up
- **AND** creates a profile for the new user with the provided nickname and role `student`

#### Scenario: Weak password response
- **WHEN** Supabase rejects a submitted password
- **THEN** the UI displays the Supabase error in Chinese-friendly form
- **AND** the frontend MUST NOT apply additional local password strength rules before submission

### Requirement: Student Role By Default
Public registration SHALL always assign new users the `student` role. The system MUST NOT expose public UI that lets a registering user choose or request `admin`.

#### Scenario: Public registration cannot create admin
- **WHEN** a visitor completes registration from the public app
- **THEN** the resulting profile role is `student`
- **AND** no registration field can set the role to `admin`

### Requirement: Manual Admin Assignment
Admin users SHALL be created or promoted manually in Supabase by changing their profile role to `admin`.

#### Scenario: Manually promoted admin accesses CMS
- **WHEN** an authenticated user has `profiles.role = 'admin'`
- **THEN** the user can access `/cms`

### Requirement: CMS Admin Gate
The system SHALL require a signed-in Supabase user with profile role `admin` to access the CMS route group.

#### Scenario: Logged-out visitor opens CMS
- **WHEN** a visitor opens `/cms` with no Supabase session
- **THEN** the system shows a Chinese login-required state instead of the CMS

#### Scenario: Student opens CMS
- **WHEN** an authenticated user with role `student` opens `/cms`
- **THEN** the system shows a Chinese access-denied state instead of the CMS

#### Scenario: Admin opens CMS
- **WHEN** an authenticated user with role `admin` opens `/cms`
- **THEN** the CMS layout and child route render

### Requirement: Chinese Auth Interface
All new user-facing authentication controls and messages SHALL be written in Chinese.

#### Scenario: Auth UI rendered
- **WHEN** the app displays login, registration, account, logout, loading, or access-denied auth states
- **THEN** the visible auth text is Chinese

### Requirement: Supabase Redirect Configuration
The deployment SHALL use Supabase Auth redirect settings compatible with production domain `https://ruihan.me` and local development at `http://localhost:5173`.

#### Scenario: Auth redirect returns to app
- **WHEN** Supabase sends the user back after an auth flow
- **THEN** URLs under `https://ruihan.me/**` and `http://localhost:5173/**` are accepted by Supabase redirect allowlist
