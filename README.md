# BeautyBarbershopBooking

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Booking API

The `/agendar` page uses the Django API. Install the root dependencies, copy `backend\.env.exemplo` to `backend\.env`, apply migrations, then start Django on `http://localhost:8000` and run the Angular development server in a second terminal. The local example uses SQLite by default, so no separate database server is required. `proxy.conf.json` forwards local `/api` requests to Django.

If the API is unavailable, the booking page can save a request in the current browser as a local-only entry. It is not confirmed by the salon, is not shared with other devices, and is not saved to the server; use the WhatsApp button to check availability with the administrator.

The Vercel configuration in `vercel.json` serves Angular and routes API requests to the Python functions in `api/`, which invoke the Django application in `backend/`. The Django source is included in this repository, so Vercel does not need to fetch a separate submodule. Vercel installs Python dependencies from the root `requirements.txt`. Before deploying, connect a persistent PostgreSQL database to the Vercel project and set `DATABASE_URL` (or `POSTGRES_URL`) and a private `DJANGO_SECRET_KEY` in the Production environment. Set `DJANGO_ALLOWED_HOSTS` to `beauty-barbershop-booking.vercel.app` and any other domains you use. Each Production deployment applies Django database migrations before building the frontend, so Production environment variables must be available to the build. Create a Django staff user after the initial deployment. The service catalog and bookings are shared through that database. Sign in at `/django-admin/` before saving service changes in the Angular admin panel; the `/admin` path remains the Angular dashboard.

On Windows, install Python and the backend dependencies with `py -m pip install -r requirements.txt`. For local development, create the ignored configuration file and choose a database with `DB_ENGINE` in `backend\.env` (`postgresql`, `mysql`, or `sqlite`):

```powershell
Copy-Item backend\.env.exemplo backend\.env
py backend\manage.py migrate
py backend\manage.py runserver 8000
```

For Vercel, configure `DATABASE_URL` (or `POSTGRES_URL`) and `DJANGO_SECRET_KEY` in the Production environment, then link the repository with the Vercel CLI. Production migrations run automatically during deployment. To create a staff account after the first successful deployment, run:

```powershell
npx vercel env run -e production -- py backend\manage.py createsuperuser
```

Never commit environment files or share database credentials.

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
