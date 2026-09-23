<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::define('admin', fn (User $user) => $user->role === 'admin');
        Gate::define('admin-or-moderator', fn (User $user) => in_array($user->role, ['admin', 'moderator'], true));
    }
}
