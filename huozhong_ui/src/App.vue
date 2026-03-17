<script setup>
import { ref } from 'vue'
import { 
  Wallet, 
  History, 
  Gift, 
  ChevronRight, 
  Bell, 
  Home, 
  User, 
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-vue-next'

const points = ref(2450)
const transactions = ref([
  { id: 1, title: 'Daily Login Bonus', date: 'Today, 09:41', amount: '+50', type: 'earn' },
  { id: 2, title: 'Starbucks Coffee', date: 'Yesterday, 14:20', amount: '-450', type: 'spend' },
  { id: 3, title: 'Referral Reward', date: 'Nov 18, 10:00', amount: '+200', type: 'earn' },
  { id: 4, title: 'Spotify Premium', date: 'Nov 15, 09:00', amount: '-990', type: 'spend' },
  { id: 5, title: 'Weekly Challenge', date: 'Nov 14, 18:30', amount: '+150', type: 'earn' },
])

const activeTab = ref('home')
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex justify-center">
    <!-- Mobile Container -->
    <div class="w-full max-w-md bg-white min-h-screen shadow-xl relative pb-20">
      
      <!-- Header -->
      <header class="bg-white px-6 pt-6 pb-4 sticky top-0 z-10">
        <div class="flex justify-between items-center mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-red-500 flex items-center justify-center text-white font-bold shadow-md">
              L
            </div>
            <div>
              <h1 class="text-sm text-gray-500 font-medium">Welcome back,</h1>
              <p class="text-lg font-bold text-gray-800">Lancelot</p>
            </div>
          </div>
          <button class="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition relative">
            <Bell class="w-5 h-5 text-gray-600" />
            <span class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>

        <!-- Points Card -->
        <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
          <!-- Decorative circles -->
          <div class="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl"></div>
          <div class="absolute bottom-0 left-0 w-32 h-32 bg-orange-500 opacity-10 rounded-full blur-2xl"></div>
          
          <div class="relative z-10">
            <div class="flex justify-between items-start mb-2">
              <span class="text-gray-400 text-sm font-medium">Total Balance</span>
              <div class="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Active
              </div>
            </div>
            <div class="flex items-baseline gap-1 mb-6">
              <span class="text-4xl font-bold tracking-tight">{{ points.toLocaleString() }}</span>
              <span class="text-orange-400 font-medium">PTS</span>
            </div>

            <div class="flex gap-3">
              <button class="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 px-4 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20">
                <ArrowUpRight class="w-4 h-4" />
                Earn
              </button>
              <button class="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 px-4 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 backdrop-blur-sm">
                <ArrowDownLeft class="w-4 h-4" />
                Redeem
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Quick Actions -->
      <section class="px-6 mb-8">
        <div class="grid grid-cols-4 gap-4">
          <button class="flex flex-col items-center gap-2 group">
            <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition shadow-sm">
              <Wallet class="w-6 h-6" />
            </div>
            <span class="text-xs font-medium text-gray-600">Wallet</span>
          </button>
          <button class="flex flex-col items-center gap-2 group">
            <div class="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition shadow-sm">
              <Gift class="w-6 h-6" />
            </div>
            <span class="text-xs font-medium text-gray-600">Rewards</span>
          </button>
          <button class="flex flex-col items-center gap-2 group">
            <div class="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center group-hover:scale-105 transition shadow-sm">
              <History class="w-6 h-6" />
            </div>
            <span class="text-xs font-medium text-gray-600">History</span>
          </button>
          <button class="flex flex-col items-center gap-2 group">
            <div class="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-105 transition shadow-sm">
              <CreditCard class="w-6 h-6" />
            </div>
            <span class="text-xs font-medium text-gray-600">Cards</span>
          </button>
        </div>
      </section>

      <!-- Recent Activity -->
      <section class="px-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-bold text-gray-800">Recent Activity</h2>
          <button class="text-orange-500 text-sm font-medium hover:text-orange-600">See All</button>
        </div>
        
        <div class="space-y-4">
          <div v-for="tx in transactions" :key="tx.id" class="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition">
            <div class="flex items-center gap-4">
              <div :class="[
                'w-10 h-10 rounded-full flex items-center justify-center',
                tx.type === 'earn' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              ]">
                <ArrowDownLeft v-if="tx.type === 'earn'" class="w-5 h-5" />
                <ArrowUpRight v-else class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-semibold text-gray-800 text-sm">{{ tx.title }}</h3>
                <p class="text-xs text-gray-500">{{ tx.date }}</p>
              </div>
            </div>
            <span :class="[
              'font-bold text-sm',
              tx.type === 'earn' ? 'text-green-600' : 'text-gray-800'
            ]">
              {{ tx.amount }}
            </span>
          </div>
        </div>
      </section>

      <!-- Bottom Navigation -->
      <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-around items-center z-50 max-w-md mx-auto">
        <button 
          @click="activeTab = 'home'"
          :class="['flex flex-col items-center gap-1 transition', activeTab === 'home' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600']"
        >
          <Home class="w-6 h-6" :stroke-width="activeTab === 'home' ? 2.5 : 2" />
          <span class="text-[10px] font-medium">Home</span>
        </button>
        
        <button 
          @click="activeTab = 'wallet'"
          :class="['flex flex-col items-center gap-1 transition', activeTab === 'wallet' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600']"
        >
          <Wallet class="w-6 h-6" :stroke-width="activeTab === 'wallet' ? 2.5 : 2" />
          <span class="text-[10px] font-medium">Wallet</span>
        </button>

        <div class="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-500/30 -mt-8 border-4 border-white cursor-pointer hover:scale-105 transition">
          <span class="text-2xl font-light leading-none">+</span>
        </div>

        <button 
          @click="activeTab = 'rewards'"
          :class="['flex flex-col items-center gap-1 transition', activeTab === 'rewards' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600']"
        >
          <Gift class="w-6 h-6" :stroke-width="activeTab === 'rewards' ? 2.5 : 2" />
          <span class="text-[10px] font-medium">Rewards</span>
        </button>

        <button 
          @click="activeTab = 'profile'"
          :class="['flex flex-col items-center gap-1 transition', activeTab === 'profile' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600']"
        >
          <User class="w-6 h-6" :stroke-width="activeTab === 'profile' ? 2.5 : 2" />
          <span class="text-[10px] font-medium">Profile</span>
        </button>
      </nav>

    </div>
  </div>
</template>

<style>
/* Hide scrollbar for Chrome, Safari and Opera */
::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
body {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
</style>
