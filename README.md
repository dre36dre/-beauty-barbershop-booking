# BeautyBarbershopBooking

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.5.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Booking API

The `/agendar` page uses the Django API. Start the backend from `Barbearia` on `http://localhost:8000`, then run the Angular development server. `proxy.conf.json` forwards local `/api` requests to Django.

Vercel serves the Angular frontend but does not automatically run this Django project from the `Barbearia` folder. Deploy Django separately, then set the `api-base-url` meta tag in `src/index.html` to the public backend origin (for example, `https://api.example.com`, without `/api`). Do not leave it as `/api` unless Vercel is explicitly routing that path to the Django backend; otherwise its frontend fallback may return `index.html` with HTTP 200 instead of JSON. Configure the Django CORS and CSRF trusted origins for the frontend domain. Service edits also require an authenticated Django staff session.

The admin service catalog is stored by Django so prices and durations are shared between devices. Sign in to Django Admin with a staff account before saving service changes in the Angular admin panel; locally, Django Admin is available at `http://localhost:8000/admin/`.

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
