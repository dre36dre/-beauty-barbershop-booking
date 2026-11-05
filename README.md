# BeautyBarbershopBooking

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Booking API

The `/agendar` page uses the Django API. Start the backend from `backend/` on `http://localhost:8000`, then run the Angular development server. `proxy.conf.json` forwards local `/api` requests to Django.

The Vercel configuration in `vercel.json` serves Angular and routes API requests to the Python functions in `api/`, which invoke the Django application in `backend/`. The Django source is included in this repository, so Vercel does not need to fetch a separate submodule. Before deploying, connect a persistent PostgreSQL database to the Vercel project and set `DATABASE_URL` (or `POSTGRES_URL`) and a private `DJANGO_SECRET_KEY` in the Production environment. Set `DJANGO_ALLOWED_HOSTS` to `beauty-barbershop-booking.vercel.app` and any other domains you use. Apply the database migrations before accepting bookings, then create a Django staff user. The service catalog and bookings are shared through that database. Sign in at `/django-admin/` before saving service changes in the Angular admin panel; the `/admin` path remains the Angular dashboard.

On Windows, install Python and the backend dependencies with `py -m pip install -r requirements.txt`, then link the repository with the Vercel CLI. Run database commands through the CLI so Production variables are injected for that command; do not pull secrets into a local environment file:

```powershell
npx vercel env run -e production -- py backend\manage.py migrate
npx vercel env run -e production -- py backend\manage.py createsuperuser
```

After migrations complete, verify that `https://beauty-barbershop-booking.vercel.app/api/servicos/` returns JSON with HTTP 200. Never commit environment files or share database credentials.

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
