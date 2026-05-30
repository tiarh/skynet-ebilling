<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '**');

        $middleware->web(append: [
            \App\Http\Middleware\SecurityHeaders::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'admin' => \App\Http\Middleware\EnsureAdmin::class,
            'global-admin' => \App\Http\Middleware\EnsureGlobalAdmin::class,
            'superadmin' => \App\Http\Middleware\EnsureSuperAdmin::class,
        ]);

        $middleware->validateCsrfTokens(except: [
            'callback/tripay',
            'webhooks/payment-gateway/*',
        ]);

        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->renderable(function (\Throwable $e, \Illuminate\Http\Request $request) {
            // Intercept only for Inertia requests
            if ($request->header('X-Inertia')) {
                
                // Let Laravel naturally handle validation (422), auth (401), and early aborts.
                // We only want to intercept catastrophic 500 crashes and unhandled exceptions.
                if (! $e instanceof \Illuminate\Validation\ValidationException && 
                    ! $e instanceof \Illuminate\Auth\AuthenticationException &&
                    ! $e instanceof \Illuminate\Http\Exceptions\HttpResponseException &&
                    ! $e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                        
                    // Send detailed error locally, but safe generic error in production
                    $message = app()->environment('production') || app()->environment('staging')
                        ? 'A server error occurred. Please try again or contact support.' 
                        : 'Server Error: ' . $e->getMessage();
                        
                    return back()->with('error', $message);
                }
            }
        });
    })->create();
