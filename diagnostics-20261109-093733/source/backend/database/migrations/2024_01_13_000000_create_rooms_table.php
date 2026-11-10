<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Переговорные комнаты и оборудование для резервирования.
     */
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('name');                       // «Переговорная №1»
            $table->unsignedInteger('capacity')->default(6);
            $table->string('location')->nullable();       // этаж/крыло
            $table->json('equipment')->nullable();        // ["Проектор","ТВ","Доска","ВКС-терминал"]
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique('name');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
