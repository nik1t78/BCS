<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Приложение работает за nginx (terminate TLS / проксирует /api),
        // поэтому доверяем заголовкам X-Forwarded-*, чтобы генерировать
        // корректные абсолютные URL в ответах API.
        if (method_exists(URL::class, 'forceRootUrl') && $this->app->environment('production')) {
            URL::forceScheme(request()->isSecure() ? 'https' : 'http');
        }

        // Безопасность сессий/cookies: httpOnly + SameSite=Lax защищают
        // sanctum-cookie и сессию от XSS-кражи и CSRF из чужих сайтов;
        // secure=true включается автоматически при HTTPS (X-Forwarded-Proto).
        $this->app['config']->set('session.http_only', true);
        $this->app['config']->set('session.same_site', 'lax');
        $this->app['config']->set('session.secure', $this->app->environment('production'));
        // Access-токены Sanctum живут 24 часа (без этого — бессрочные токены)
        $this->app['config']->set('sanctum.expiration', 1440);

        // Defense-in-depth: security-заголовки на уровне Laravel, даже если
        // запрос пришёл мимо nginx (artisan serve, прямой доступ к php-fpm).
        $kernel = $this->app->make(\Illuminate\Contracts\Http\Kernel::class);
        if (method_exists($kernel, 'pushMiddleware')) {
            $kernel->pushMiddleware(\App\Http\Middleware\SecurityHeaders::class);
        }

        // Rate limiting для API (подключается middleware throttle:api в routes/api.php)
        RateLimiter::for('api', function (Request $request) {
            return $request->user()
                ? Limit::perMinute(120)->by($request->user()->id)
                : Limit::perMinute(20)->by($request->ip());
        });

        // Жёсткий лимит на подбор пароля: 10 попыток в минуту с IP+логин
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(10)
                ->by($request->ip() . '|' . strtolower((string) $request->input('login')))
                ->response(fn () => response()->json([
                    'message' => 'Слишком много попыток входа. Повторите через минуту.',
                ], 429));
        });
    }
}
