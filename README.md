# BeautyBarbershopBooking

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Backend and database

The booking API is implemented as TypeScript functions in `api/` and connects to PostgreSQL with `pg`. It uses the existing Neon/Django tables, so the Node migration keeps current client, service, and appointment data intact. `database/schema.sql` creates the compatible schema for a new database; `scripts/migrate-db.mjs` applies it and seeds only missing default records. Production deployments run this idempotent migration before the Angular build.

For local development, install Node dependencies with `npm install` and use `vercel dev` from a linked project. Configure `DATABASE_URL` with the Neon connection string. Do not commit `.env` files or share database credentials.

In Vercel Production, set:

- `DATABASE_URL`: the Neon PostgreSQL connection string.
- `ADMIN_USERNAME` and `ADMIN_PASSWORD`: credentials for the protected admin panel.
- `ADMIN_SESSION_SECRET`: a random secret of at least 32 characters. The existing `DJANGO_SECRET_KEY` is also accepted as a fallback during migration.

Customer bookings are public and are written to PostgreSQL. The `/admin` dashboard reads shared appointments from that database; sign in at `/django-admin/` on each device, then open `/admin` and refresh the appointment list. Each browser/device has its own admin session.

The API endpoints are `/api/servicos/`, `/api/clientes/`, `/api/profissionais/`, `/api/horarios/`, `/api/resumo/`, `/api/agendamentos/`, and `/api/admin/agendamentos/`. Admin appointment and service management routes require the Node admin session.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
