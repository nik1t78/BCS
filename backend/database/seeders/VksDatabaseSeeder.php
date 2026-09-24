<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Meeting;
use App\Models\Notification;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class VksDatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Идемпотентный сид: при повторном запуске существующие пользователи
        // обновляются (в т.ч. перезаписывается корректным хэшем пароля),
        // а не вызывают ошибку уникальности login.
        // Модель User имеет каст 'password' => 'hashed', поэтому передаём
        // пароль как есть — иначе происходит двойное хеширование и вход ломается.
        $admin = User::updateOrCreate(['login' => 'admin'], [
            'name' => 'Администратор Системы',
            'password' => 'admin123',
            'role' => 'admin',
            'phone' => '+7 (999) 000-00-01',
            'department' => 'IT',
            'position' => 'Системный администратор',
            'is_active' => true,
        ]);

        $user1 = User::updateOrCreate(['login' => 'ivanov'], [
            'name' => 'Иванов Алексей Сергеевич',
            'password' => 'user123',
            'role' => 'user',
            'phone' => '+7 (999) 111-22-33',
            'department' => 'Разработка',
            'position' => 'Frontend Developer',
            'is_active' => true,
        ]);

        $user2 = User::updateOrCreate(['login' => 'petrova'], [
            'name' => 'Петрова Мария Владимировна',
            'password' => 'user123',
            'role' => 'user',
            'phone' => '+7 (999) 222-33-44',
            'department' => 'Менеджмент',
            'position' => 'Project Manager',
            'is_active' => true,
        ]);

        $moderator = User::updateOrCreate(['login' => 'sidorov'], [
            'name' => 'Сидоров Константин Львович',
            'password' => 'mod123',
            'role' => 'moderator',
            'phone' => '+7 (999) 333-44-55',
            'department' => 'HR',
            'position' => 'HR Manager',
            'is_active' => true,
        ]);

        // Создание конференций
        $today = Carbon::today();
        $tomorrow = Carbon::tomorrow();
        $dayAfter = Carbon::today()->addDays(2);
        $nextWeek = Carbon::today()->addDays(5);
        $yesterday = Carbon::yesterday();

        Meeting::create([
            'title' => 'Еженедельный стендап',
            'description' => 'Обсуждение прогресса',
            'date' => $today,
            'start_time' => '10:00',
            'end_time' => '10:30',
            'organizer_id' => $user2->id,
            'participants' => [$user1->id, $user2->id, $moderator->id],
            'participant_emails' => [],
            'link' => 'https://meet.example.com/standup',
            'room' => 'Переговорная №1',
            'status' => 'scheduled',
            'reminder_minutes' => 10,
            'recurring' => 'weekly',
            'priority' => 'high',
            'is_private' => false,
        ]);

        Meeting::create([
            'title' => 'Обзор проекта Q4',
            'description' => 'Презентация результатов',
            'date' => $today,
            'start_time' => '14:00',
            'end_time' => '15:30',
            'organizer_id' => $admin->id,
            'participants' => [$user1->id, $user2->id],
            'participant_emails' => ['client@example.com'],
            'link' => 'https://meet.example.com/q4',
            'room' => 'Конференц-зал А',
            'status' => 'scheduled',
            'reminder_minutes' => 30,
            'recurring' => 'none',
            'priority' => 'high',
            'is_private' => false,
        ]);

        Meeting::create([
            'title' => 'Собеседование',
            'description' => 'Senior Frontend Developer',
            'date' => $tomorrow,
            'start_time' => '11:00',
            'end_time' => '12:00',
            'organizer_id' => $moderator->id,
            'participants' => [$moderator->id],
            'participant_emails' => ['candidate@example.com'],
            'link' => 'https://meet.example.com/interview',
            'room' => 'Онлайн',
            'status' => 'scheduled',
            'reminder_minutes' => 15,
            'recurring' => 'none',
            'priority' => 'medium',
            'is_private' => true,
        ]);

        Meeting::create([
            'title' => 'Демо продукта',
            'description' => 'Показ заказчику',
            'date' => $tomorrow,
            'start_time' => '16:00',
            'end_time' => '17:00',
            'organizer_id' => $user2->id,
            'participants' => [$user1->id, $user2->id, $admin->id],
            'participant_emails' => [],
            'link' => 'https://meet.example.com/demo',
            'room' => 'Переговорная №3',
            'status' => 'scheduled',
            'reminder_minutes' => 15,
            'recurring' => 'none',
            'priority' => 'high',
            'is_private' => false,
        ]);

        Meeting::create([
            'title' => 'Ретроспектива',
            'description' => 'Анализ спринта',
            'date' => $dayAfter,
            'start_time' => '15:00',
            'end_time' => '16:00',
            'organizer_id' => $user2->id,
            'participants' => [$user1->id, $user2->id],
            'participant_emails' => [],
            'link' => 'https://meet.example.com/retro',
            'room' => 'Переговорная №2',
            'status' => 'scheduled',
            'reminder_minutes' => 10,
            'recurring' => 'weekly',
            'priority' => 'medium',
            'is_private' => false,
        ]);

        Meeting::create([
            'title' => 'Обучение: Новый стек',
            'description' => 'Тренинг',
            'date' => $nextWeek,
            'start_time' => '10:00',
            'end_time' => '12:00',
            'organizer_id' => $admin->id,
            'participants' => [$user1->id, $user2->id, $moderator->id],
            'participant_emails' => [],
            'link' => 'https://meet.example.com/training',
            'room' => 'Конференц-зал Б',
            'status' => 'scheduled',
            'reminder_minutes' => 60,
            'recurring' => 'none',
            'priority' => 'low',
            'is_private' => false,
        ]);

        Meeting::create([
            'title' => 'Планёрка с клиентом',
            'description' => 'Обсуждение требований',
            'date' => $yesterday,
            'start_time' => '09:00',
            'end_time' => '10:00',
            'organizer_id' => $user2->id,
            'participants' => [$user1->id, $user2->id],
            'participant_emails' => ['client@example.com'],
            'link' => 'https://meet.example.com/client',
            'room' => 'Онлайн',
            'status' => 'completed',
            'reminder_minutes' => 15,
            'recurring' => 'none',
            'priority' => 'medium',
            'is_private' => false,
        ]);

        Meeting::create([
            'title' => 'Архитектурный комитет',
            'description' => 'Новые решения',
            'date' => $yesterday,
            'start_time' => '14:00',
            'end_time' => '15:00',
            'organizer_id' => $admin->id,
            'participants' => [$admin->id, $user1->id],
            'participant_emails' => [],
            'link' => 'https://meet.example.com/arch',
            'room' => 'Переговорная №1',
            'status' => 'completed',
            'reminder_minutes' => 15,
            'recurring' => 'monthly',
            'priority' => 'high',
            'is_private' => false,
        ]);

        // Создание уведомлений
        Notification::create([
            'user_id' => $user1->id,
            'meeting_id' => 1,
            'message' => '⏰ Напоминание: через 10 мин. начнётся "Еженедельный стендап"',
            'type' => 'reminder',
            'read' => false,
        ]);

        Notification::create([
            'user_id' => $user1->id,
            'meeting_id' => 1,
            'message' => '🔴 Конференция "Еженедельный стендап" начинается!',
            'type' => 'starting',
            'read' => true,
        ]);

        Notification::create([
            'user_id' => $user2->id,
            'meeting_id' => 7,
            'message' => '✅ Конференция "Планёрка с клиентом" завершена',
            'type' => 'info',
            'read' => true,
        ]);

        Notification::create([
            'user_id' => $user1->id,
            'meeting_id' => 1,
            'message' => '👤 Вас добавили в конференцию "Еженедельный стендап"',
            'type' => 'user-added',
            'read' => true,
        ]);

        $this->command->info('✅ Демо-данные успешно созданы!');
        $this->command->info('');
        $this->command->info('Демо-аккаунты:');
        $this->command->info('  Админ: admin@vks.local / admin123');
        $this->command->info('  Пользователь: ivanov@vks.local / user123');
        $this->command->info('  Модератор: sidorov@vks.local / mod123');
    }
}
