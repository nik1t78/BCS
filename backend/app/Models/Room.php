<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'name',
        'capacity',
        'location',
        'equipment',
        'description',
        'is_active',
    ];

    protected $casts = [
        'equipment' => 'array',
        'is_active' => 'boolean',
    ];
}
