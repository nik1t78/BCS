<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Meeting;
use App\Models\Notification;
use App\Models\Room;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class VksDatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Идемпотентный сид: при повторном запуске существующие пользователи
        // обновляются, а не вызывают ошибку уникальности login.
        // Пароли задаются ПРЕДВЫЧИСЛЕННЫМИ bcrypt-хэшами со статическим salt.
        // Это гарантирует одинаковый корректный хэш на любом окружении и
        // защищает от двух проблем: (1) двойное хеширование из-за каста
        // 'password' => 'hashed' в модели, если хэш уже готовый; (2) рассинхрон
        // хэшей при пересоздании пользователей.
        // standard passwords (login + 123):
        //   admin    / admin123
        //   sidorov  / sidorov123
        //   ivanov   / ivanov123
        //   petrova  / petrova123
        $hashAdmin    = '$2y$10$.3Eo7OX4oP6Kl/fV9bVD5OgPhjielQMQ3kVIJShvnZdtwXnhJ.JGe';
        $hashSidorov  = '$2y$10$KgTQVDOvfVu7ZIa1.HNzAeiWc0gPAJG2fesCBbnYk9d0.bScZiasK';
        $hashIvanov   = '$2y$10$gZzcTdZFdXucOOYSP5egy.trQaRfpeF/vj8UbG7iMcspQyJ5Boslu';
        $hashPetrova  = '$2y$10$8onvxpNZgJoLzzQmTomzCO1jI6sZseIAu.jPPSBlOCd6E5UFLqpsi';

        $admin = User::updateOrCreate(['login' => 'admin'], [
            'name' => 'Администратор Системы',
            'password' => $hashAdmin,
            'role' => 'admin',
            'phone' => '+7 (999) 000-00-01',
            'department' => 'IT',
            'position' => 'Системный администратор',
            'is_active' => true,
        ]);

        $user1 = User::updateOrCreate(['login' => 'ivanov'], [
            'name' => 'Иванов Алексей Сергеевич',
            'password' => $hashIvanov,
            'role' => 'user',
            'phone' => '+7 (999) 111-22-33',
            'department' => 'Разработка',
            'position' => 'Frontend Developer',
            'is_active' => true,
        ]);

        $user2 = User::updateOrCreate(['login' => 'petrova'], [
            'name' => 'Петрова Мария Владимировна',
            'password' => $hashPetrova,
            'role' => 'user',
            'phone' => '+7 (999) 222-33-44',
            'department' => 'Менеджмент',
            'position' => 'Project Manager',
            'is_active' => true,
        ]);

        $moderator = User::updateOrCreate(['login' => 'sidorov'], [
            'name' => 'Сидоров Константин Львович',
            'password' => $hashSidorov,
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
            'room' => 'Переговорная А (3 этаж)',
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
            'room' => 'Конференц-зал (4 этаж)',
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
            'room' => 'Переговорная Б (3 этаж)',
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
            'room' => 'Митинг-рум (2 этаж)',
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
            'room' => 'Конференц-зал (4 этаж)',
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
            'room' => 'Переговорная А (3 этаж)',
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

        // Переговорные комнаты: без них вкладка «Комнаты» в админке и выбор
        // комнаты при создании конференции пустые (счётчик показывал 0).
        $demoRooms = [
            ['name' => 'Переговорная А (3 этаж)', 'capacity' => 8,  'location' => 'Кабинет 301', 'equipment' => ['Проектор', 'Доска', 'Видеоконференцсвязь']],
            ['name' => 'Переговорная Б (3 этаж)', 'capacity' => 5,  'location' => 'Кабинет 305', 'equipment' => ['Телевизор', 'Доска']],
            ['name' => 'Конференц-зал (4 этаж)',  'capacity' => 20, 'location' => 'Кабинет 410', 'equipment' => ['Проектор', 'Микрофоны', 'Камера ВКС', 'Доска']],
            ['name' => 'Митинг-рум (2 этаж)',     'capacity' => 4,  'location' => 'Кабинет 215', 'equipment' => ['Телевизор']],
        ];
        foreach ($demoRooms as $room) {
            Room::updateOrCreate(['name' => $room['name']], $room + ['is_active' => true]);
        }

        $this->command->info('✅ Демо-данные успешно созданы!');
        $this->command->info('');
        $this->command->info('Демо-аккаунты (логин без домена):');
        $this->command->info('  Админ:      admin    / admin123');
        $this->command->info('  Модератор:  sidorov  / sidorov123');
        $this->command->info('  Пользователь: ivanov   / ivanov123');
        $this->command->info('  Пользователь: petrova  / petrova123');
    }
}
