import React, { useState, useEffect } from 'react';

interface TourProps {
  onComplete: () => void;
}

export default function Tour({ onComplete }: TourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Добро пожаловать в ВКС Расписание!',
      description: 'Это система управления видеоконференциями. Давайте быстро ознакомимся с основными функциями.',
      icon: 'fa-hand-sparkles',
      color: 'from-blue-500 to-purple-600',
    },
    {
      title: 'Главная страница',
      description: 'Здесь вы видите обзор всех конференций на сегодня, следующую встречу и быструю статистику.',
      icon: 'fa-home',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Расписание',
      description: 'Просматривайте конференции в удобном формате: день, неделя или месяц. Фильтруйте по своим встречам.',
      icon: 'fa-calendar-alt',
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Мои конференции',
      description: 'Управляйте своими встречами: создавайте новые, редактируйте существующие, добавляйте участников.',
      icon: 'fa-video',
      color: 'from-orange-500 to-red-600',
    },
    {
      title: 'Уведомления',
      description: 'Получайте напоминания о предстоящих конференциях. Настройте звук и браузерные уведомления в профиле.',
      icon: 'fa-bell',
      color: 'from-yellow-500 to-orange-600',
    },
    {
      title: 'Готово!',
      description: 'Теперь вы знаете основы. Начните с создания первой конференции или просмотрите существующие.',
      icon: 'fa-check-circle',
      color: 'from-green-500 to-emerald-600',
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Progress */}
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className={`w-16 h-16 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center mb-6 mx-auto`}>
            <i className={`fas ${step.icon} text-white text-2xl`}></i>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 text-center mb-3">{step.title}</h2>
          <p className="text-gray-600 text-center leading-relaxed">{step.description}</p>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {steps.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                i === currentStep ? 'bg-blue-600 w-6' : i < currentStep ? 'bg-blue-300' : 'bg-gray-200'
              }`}></div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex items-center justify-between">
          <button onClick={handleSkip} className="text-gray-500 hover:text-gray-700 text-sm">
            Пропустить
          </button>
          <button onClick={handleNext}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-lg font-medium hover:shadow-lg transition-all">
            {currentStep === steps.length - 1 ? 'Начать' : 'Далее'}
          </button>
        </div>
      </div>
    </div>
  );
}
