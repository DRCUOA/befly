<template>
  <div class="admin-page">
    <!-- Header -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-6xl mx-auto">
        <p class="text-xs sm:text-sm tracking-widest uppercase font-sans text-ink-lighter mb-4">
          Administration
        </p>
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4">
          User Management
        </h1>
        <p class="text-base sm:text-lg font-light text-ink-light">
          Manage users, roles, and all content
        </p>
      </div>
    </div>

    <!-- Content -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12 bg-paper">
      <div class="max-w-6xl mx-auto">
        <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <p class="text-sm text-ink-lighter uppercase tracking-wider">Total Users</p>
            <p class="text-2xl font-semibold mt-1">{{ totalUsers }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <p class="text-sm text-ink-lighter uppercase tracking-wider">Admins</p>
            <p class="text-2xl font-semibold mt-1">{{ adminCount }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <p class="text-sm text-ink-lighter uppercase tracking-wider">Active</p>
            <p class="text-2xl font-semibold mt-1 text-green-600">{{ activeCount }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <p class="text-sm text-ink-lighter uppercase tracking-wider">Suspended</p>
            <p class="text-2xl font-semibold mt-1 text-red-600">{{ suspendedCount }}</p>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading users...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
          <p class="text-red-800">{{ error }}</p>
          <button @click="loadUsers" class="mt-3 text-sm text-red-600 hover:text-red-800 underline">
            Try again
          </button>
        </div>

        <!-- User List -->
        <div v-else class="space-y-4">
          <div
            v-for="u in users"
            :key="u.id"
            class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden"
          >
            <!-- User Row (always visible) -->
            <div
              class="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
              @click="toggleExpand(u.id)"
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <!-- Expand chevron -->
                <svg
                  class="w-4 h-4 text-ink-lighter flex-shrink-0 transition-transform duration-200"
                  :class="{ 'rotate-90': expandedUserId === u.id }"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>

                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-ink truncate">{{ u.displayName }}</span>
                    <span v-if="u.id === currentUserId" class="text-xs text-ink-lighter italic">(you)</span>
                  </div>
                  <span class="text-sm text-ink-lighter truncate">{{ u.email }}</span>
                </div>
              </div>

              <div class="flex items-center gap-2 sm:gap-3 flex-wrap" @click.stop>
                <!-- Role badge -->
                <span
                  class="inline-block px-2 py-1 text-xs rounded font-medium"
                  :class="{
                    'bg-purple-100 text-purple-800': u.role === 'admin',
                    'bg-gray-100 text-gray-700': u.role === 'user'
                  }"
                >
                  {{ u.role }}
                </span>

                <!-- Status badge -->
                <span
                  class="inline-block px-2 py-1 text-xs rounded font-medium"
                  :class="{
                    'bg-green-100 text-green-800': u.status === 'active',
                    'bg-yellow-100 text-yellow-800': u.status === 'inactive',
                    'bg-red-100 text-red-800': u.status === 'suspended'
                  }"
                >
                  {{ u.status }}
                </span>

                <span class="text-xs text-ink-lighter hidden sm:inline">{{ formatDate(u.createdAt) }}</span>

                <!-- Role Toggle -->
                <button
                  v-if="u.id !== currentUserId"
                  @click="toggleRole(u)"
                  :disabled="actionInProgress === u.id"
                  class="px-2.5 py-1 text-xs rounded border transition-colors disabled:opacity-50"
                  :class="u.role === 'admin'
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    : 'border-purple-300 text-purple-700 hover:bg-purple-50'"
                >
                  {{ u.role === 'admin' ? 'Demote' : 'Promote' }}
                </button>

                <!-- Status Toggle -->
                <button
                  v-if="u.id !== currentUserId"
                  @click="toggleStatus(u)"
                  :disabled="actionInProgress === u.id"
                  class="px-2.5 py-1 text-xs rounded border transition-colors disabled:opacity-50"
                  :class="u.status === 'active'
                    ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                    : 'border-green-300 text-green-700 hover:bg-green-50'"
                >
                  {{ u.status === 'active' ? 'Suspend' : 'Activate' }}
                </button>

                <!-- Delete User -->
                <button
                  v-if="u.id !== currentUserId"
                  @click="confirmDeleteUser(u)"
                  :disabled="actionInProgress === u.id"
                  class="px-2.5 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>

            <!-- Expanded Content Panel -->
            <div v-if="expandedUserId === u.id" class="border-t border-gray-100">
              <!-- Loading content -->
              <div v-if="contentLoading" class="text-center py-8">
                <p class="text-sm text-ink-lighter">Loading content...</p>
              </div>

              <div v-else-if="userContent" class="p-4 space-y-6">
                <!-- ── Writings ── -->
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-3">
                    Essays ({{ userContent.writings.length }})
                  </h3>
                  <div v-if="userContent.writings.length === 0" class="text-sm text-ink-lighter italic py-2">
                    No essays
                  </div>
                  <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b border-gray-100">
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Title</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Visibility</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Created</th>
                          <th class="text-right px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="w in userContent.writings"
                          :key="w.id"
                          class="border-b border-gray-50 hover:bg-gray-50/50"
                        >
                          <td class="px-3 py-2">
                            <router-link
                              :to="`/read/${w.id}`"
                              class="text-ink hover:text-blue-600 font-medium"
                              target="_blank"
                            >
                              {{ w.title }}
                            </router-link>
                            <p class="text-xs text-ink-lighter mt-0.5 line-clamp-1">{{ w.bodyPreview }}</p>
                          </td>
                          <td class="px-3 py-2">
                            <select
                              :value="w.visibility"
                              @change="changeWritingVisibility(w, ($event.target as HTMLSelectElement).value)"
                              class="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              <option value="private">private</option>
                              <option value="shared">shared</option>
                              <option value="public">public</option>
                            </select>
                          </td>
                          <td class="px-3 py-2 text-ink-lighter text-xs whitespace-nowrap">
                            {{ formatDate(w.createdAt) }}
                          </td>
                          <td class="px-3 py-2 text-right">
                            <button
                              @click="confirmDeleteWriting(w)"
                              :disabled="actionInProgress === w.id"
                              class="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- ── Comments ── -->
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-3">
                    Comments ({{ userContent.comments.length }})
                  </h3>
                  <div v-if="userContent.comments.length === 0" class="text-sm text-ink-lighter italic py-2">
                    No comments
                  </div>
                  <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b border-gray-100">
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Comment</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">On Essay</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Date</th>
                          <th class="text-right px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="c in userContent.comments"
                          :key="c.id"
                          class="border-b border-gray-50 hover:bg-gray-50/50"
                        >
                          <td class="px-3 py-2 max-w-xs">
                            <p class="text-ink line-clamp-2">{{ c.content }}</p>
                          </td>
                          <td class="px-3 py-2 text-ink-lighter text-xs">
                            <router-link
                              v-if="c.writingTitle"
                              :to="`/read/${c.writingId}`"
                              class="hover:text-blue-600"
                              target="_blank"
                            >
                              {{ c.writingTitle }}
                            </router-link>
                            <span v-else class="italic">deleted essay</span>
                          </td>
                          <td class="px-3 py-2 text-ink-lighter text-xs whitespace-nowrap">
                            {{ formatDate(c.createdAt) }}
                          </td>
                          <td class="px-3 py-2 text-right">
                            <button
                              @click="confirmDeleteComment(c)"
                              :disabled="actionInProgress === c.id"
                              class="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- ── Appreciations ── -->
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-3">
                    Appreciations ({{ userContent.appreciations.length }})
                  </h3>
                  <div v-if="userContent.appreciations.length === 0" class="text-sm text-ink-lighter italic py-2">
                    No appreciations
                  </div>
                  <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b border-gray-100">
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Reaction</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">On Essay</th>
                          <th class="text-left px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Date</th>
                          <th class="text-right px-3 py-2 text-xs font-semibold uppercase text-ink-lighter">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="a in userContent.appreciations"
                          :key="a.id"
                          class="border-b border-gray-50 hover:bg-gray-50/50"
                        >
                          <td class="px-3 py-2">
                            <span class="inline-flex items-center gap-1.5">
                              <span>{{ reactionEmoji(a.reactionType) }}</span>
                              <span class="text-ink-lighter text-xs">{{ a.reactionType }}</span>
                            </span>
                          </td>
                          <td class="px-3 py-2 text-ink-lighter text-xs">
                            <router-link
                              v-if="a.writingTitle"
                              :to="`/read/${a.writingId}`"
                              class="hover:text-blue-600"
                              target="_blank"
                            >
                              {{ a.writingTitle }}
                            </router-link>
                            <span v-else class="italic">deleted essay</span>
                          </td>
                          <td class="px-3 py-2 text-ink-lighter text-xs whitespace-nowrap">
                            {{ formatDate(a.createdAt) }}
                          </td>
                          <td class="px-3 py-2 text-right">
                            <button
                              @click="confirmDeleteAppreciation(a)"
                              :disabled="actionInProgress === a.id"
                              class="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- Usage Analytics Section                                     -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="w-full px-4 sm:px-6 md:px-8 py-8 sm:py-12 bg-gray-50 border-t border-gray-200">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-2xl sm:text-3xl font-light tracking-tight mb-2">Usage Analytics</h2>
        <p class="text-sm text-ink-lighter mb-8">Activity data including signed-in and anonymous users</p>

        <!-- Loading / Error -->
        <div v-if="statsLoading" class="text-center py-16">
          <p class="text-lg font-light text-ink-light">Loading analytics...</p>
        </div>
        <div v-else-if="statsError" class="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
          <p class="text-red-800">{{ statsError }}</p>
          <button @click="loadStats" class="mt-3 text-sm text-red-600 hover:text-red-800 underline">Try again</button>
        </div>

        <template v-else-if="stats">
          <!-- ── Overview cards ── -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
              <p class="text-xs text-ink-lighter uppercase tracking-wider mb-1">Total Events</p>
              <p class="text-3xl font-semibold">{{ stats.total.toLocaleString() }}</p>
            </div>
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
              <p class="text-xs text-ink-lighter uppercase tracking-wider mb-1">Unique Users</p>
              <p class="text-3xl font-semibold text-blue-600">{{ stats.anonVsAuth.uniqueUsers }}</p>
            </div>
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
              <p class="text-xs text-ink-lighter uppercase tracking-wider mb-1">Authenticated</p>
              <p class="text-3xl font-semibold text-green-600">{{ stats.anonVsAuth.authenticated.toLocaleString() }}</p>
            </div>
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
              <p class="text-xs text-ink-lighter uppercase tracking-wider mb-1">Anonymous</p>
              <p class="text-3xl font-semibold text-amber-500">{{ stats.anonVsAuth.anonymous.toLocaleString() }}</p>
            </div>
          </div>

          <!-- ── Auth vs Anonymous donut ── -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-4">Authenticated vs Anonymous</h3>
              <div class="flex items-center justify-center">
                <div class="donut-chart">
                  <svg viewBox="0 0 120 120" class="w-40 h-40">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" stroke-width="18" />
                    <circle
                      cx="60" cy="60" r="50"
                      fill="none"
                      stroke="#22c55e"
                      stroke-width="18"
                      :stroke-dasharray="authDonut.authDash"
                      stroke-dashoffset="0"
                      transform="rotate(-90 60 60)"
                      stroke-linecap="round"
                    />
                    <circle
                      cx="60" cy="60" r="50"
                      fill="none"
                      stroke="#f59e0b"
                      stroke-width="18"
                      :stroke-dasharray="authDonut.anonDash"
                      :stroke-dashoffset="'-' + authDonut.anonOffset"
                      transform="rotate(-90 60 60)"
                      stroke-linecap="round"
                    />
                    <text x="60" y="56" text-anchor="middle" class="text-xs fill-ink-lighter" font-size="10">total</text>
                    <text x="60" y="70" text-anchor="middle" class="text-sm fill-ink font-semibold" font-size="14">{{ stats.total }}</text>
                  </svg>
                </div>
                <div class="ml-6 space-y-2 text-sm">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
                    Authenticated ({{ authPct }}%)
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                    Anonymous ({{ anonPct }}%)
                  </div>
                </div>
              </div>
            </div>

            <!-- ── Activity type breakdown (horizontal bars) ── -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-4">Activity by Type</h3>
              <div class="space-y-3">
                <div v-for="item in stats.byType" :key="item.activityType" class="space-y-1">
                  <div class="flex justify-between text-xs">
                    <span class="capitalize font-medium">{{ item.activityType }}</span>
                    <span class="text-ink-lighter">{{ item.count }}</span>
                  </div>
                  <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-700"
                      :style="{ width: barWidth(item.count, maxTypeCount) + '%' }"
                      :class="typeColor(item.activityType)"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Daily activity chart (30 days) ── -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5 mb-10" v-if="stats.daily.length > 0">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-4">Daily Activity (Last 30 Days)</h3>
            <div class="daily-chart-container overflow-x-auto">
              <div class="daily-chart" :style="{ minWidth: stats.daily.length * 24 + 'px' }">
                <!-- Y-axis label -->
                <div class="flex items-end gap-px h-48 relative">
                  <!-- Gridlines -->
                  <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    <div class="border-b border-dashed border-gray-100 w-full"></div>
                    <div class="border-b border-dashed border-gray-100 w-full"></div>
                    <div class="border-b border-dashed border-gray-100 w-full"></div>
                    <div class="border-b border-dashed border-gray-100 w-full"></div>
                  </div>

                  <div
                    v-for="day in stats.daily"
                    :key="day.date"
                    class="flex-1 flex flex-col items-center justify-end gap-0 relative group"
                  >
                    <!-- Stacked bar: authenticated (bottom) + anonymous (top) -->
                    <div
                      class="w-full max-w-[16px] rounded-t transition-all duration-500 bg-amber-400"
                      :style="{ height: barHeight(day.anonymous, maxDailyCount) + 'px' }"
                    ></div>
                    <div
                      class="w-full max-w-[16px] bg-blue-500 transition-all duration-500"
                      :class="{ 'rounded-t': day.anonymous === 0 }"
                      :style="{ height: barHeight(day.authenticated, maxDailyCount) + 'px' }"
                    ></div>

                    <!-- Tooltip -->
                    <div class="absolute bottom-full mb-2 hidden group-hover:block z-10">
                      <div class="bg-gray-800 text-white text-xs rounded py-1.5 px-2 whitespace-nowrap shadow-lg">
                        <div class="font-medium">{{ formatShortDate(day.date) }}</div>
                        <div class="text-green-300">Auth: {{ day.authenticated }}</div>
                        <div class="text-amber-300">Anon: {{ day.anonymous }}</div>
                        <div class="text-gray-300 border-t border-gray-600 mt-0.5 pt-0.5">Total: {{ day.total }}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- X-axis labels (show every 5th) -->
                <div class="flex gap-px mt-1">
                  <div
                    v-for="(day, idx) in stats.daily"
                    :key="'lbl-' + day.date"
                    class="flex-1 text-center"
                  >
                    <span v-if="idx % 5 === 0 || idx === stats.daily.length - 1" class="text-[9px] text-ink-lighter">
                      {{ formatAxisDate(day.date) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <!-- Legend -->
            <div class="flex gap-4 mt-3 text-xs text-ink-lighter justify-end">
              <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-blue-500 inline-block"></span> Authenticated</div>
              <div class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-amber-400 inline-block"></span> Anonymous</div>
            </div>
          </div>

          <!-- ── Hourly heatmap ── -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5 mb-10">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-4">Activity by Hour of Day</h3>
            <div class="flex items-end gap-1 h-32">
              <div
                v-for="h in stats.hourly"
                :key="h.hour"
                class="flex-1 flex flex-col items-center justify-end group relative"
              >
                <div
                  class="w-full rounded-t transition-all duration-500"
                  :style="{ height: barHeight(h.count, maxHourlyCount) + 'px' }"
                  :class="hourColor(h.count, maxHourlyCount)"
                ></div>
                <!-- Tooltip -->
                <div class="absolute bottom-full mb-1 hidden group-hover:block z-10">
                  <div class="bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow">
                    {{ formatHour(h.hour) }}: {{ h.count }} events
                  </div>
                </div>
              </div>
            </div>
            <div class="flex gap-1 mt-1">
              <div v-for="h in stats.hourly" :key="'h-' + h.hour" class="flex-1 text-center">
                <span v-if="h.hour % 3 === 0" class="text-[9px] text-ink-lighter">{{ formatHour(h.hour) }}</span>
              </div>
            </div>
          </div>

          <!-- ── Top users & top writings side by side ── -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <!-- Top active users -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-4">Most Active Users</h3>
              <div v-if="stats.topUsers.length === 0" class="text-sm text-ink-lighter italic py-4">No data</div>
              <div v-else class="space-y-2.5">
                <div v-for="(u, idx) in stats.topUsers" :key="u.userId" class="flex items-center gap-3">
                  <span class="text-xs text-ink-lighter w-4 text-right font-mono">{{ idx + 1 }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="text-sm font-medium truncate">{{ u.displayName }}</span>
                      <span class="text-xs text-ink-lighter">{{ u.count }} events</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        class="h-full rounded-full bg-blue-500 transition-all duration-700"
                        :style="{ width: barWidth(u.count, stats.topUsers[0].count) + '%' }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top writings -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
              <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-4">Most Interacted Writings</h3>
              <div v-if="stats.topWritings.length === 0" class="text-sm text-ink-lighter italic py-4">No data</div>
              <div v-else class="space-y-2.5">
                <div v-for="(w, idx) in stats.topWritings" :key="w.resourceId" class="flex items-center gap-3">
                  <span class="text-xs text-ink-lighter w-4 text-right font-mono">{{ idx + 1 }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <router-link
                        v-if="w.title !== 'Deleted'"
                        :to="`/read/${w.resourceId}`"
                        class="text-sm font-medium truncate hover:text-blue-600"
                        target="_blank"
                      >
                        {{ w.title }}
                      </router-link>
                      <span v-else class="text-sm font-medium text-ink-lighter italic">Deleted</span>
                      <span class="text-xs text-ink-lighter flex-shrink-0">{{ w.count }} events / {{ w.uniqueVisitors }} visitors</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        class="h-full rounded-full bg-purple-500 transition-all duration-700"
                        :style="{ width: barWidth(w.count, stats.topWritings[0].count) + '%' }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Action breakdown (pill chart) ── -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5 mb-10">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-4">Actions Breakdown</h3>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="a in stats.byAction"
                :key="a.action"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
                :class="actionPillClass(a.action)"
              >
                <span class="capitalize">{{ a.action }}</span>
                <span class="opacity-60">{{ a.count }}</span>
              </div>
            </div>
          </div>

          <!-- ── Recent activity feed ── -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-lighter mb-4">Recent Activity Feed</h3>
            <div class="space-y-0">
              <div
                v-for="ev in stats.recentActivity"
                :key="ev.id"
                class="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0"
              >
                <!-- Activity type dot -->
                <span
                  class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  :class="typeDotColor(ev.activityType)"
                ></span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-medium">{{ ev.userDisplayName || 'Anonymous' }}</span>
                    <span class="text-xs text-ink-lighter capitalize">{{ ev.action }}</span>
                    <span v-if="ev.resourceType" class="text-xs text-ink-lighter">
                      {{ ev.resourceType.replace('_', ' ') }}
                    </span>
                  </div>
                  <div class="text-xs text-ink-lighter mt-0.5">
                    {{ formatRelativeTime(ev.createdAt) }}
                    <span v-if="!ev.userId" class="ml-1 text-amber-600">(anonymous)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </template>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- Overlays (feedback + delete modal)                          -->
    <!-- ═══════════════════════════════════════════════════════════ -->

    <!-- Feedback Message -->
    <div
      v-if="feedbackMessage"
      class="fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 transition-opacity"
      :class="feedbackType === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'"
    >
      {{ feedbackMessage }}
    </div>

        <!-- Delete Confirmation Modal -->
        <div v-if="deleteModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 class="text-lg font-semibold mb-2">{{ deleteModal.title }}</h3>
            <p class="text-ink-light mb-1">{{ deleteModal.message }}</p>
            <p v-if="deleteModal.detail" class="font-medium mb-1">{{ deleteModal.detail }}</p>
            <p v-if="deleteModal.subDetail" class="text-sm text-ink-lighter mb-4">{{ deleteModal.subDetail }}</p>
            <p class="text-sm text-red-600 mb-6">{{ deleteModal.warning }}</p>
            <div class="flex justify-end gap-3">
              <button
                @click="deleteModal = null"
                class="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                @click="executeDelete"
                :disabled="deleteModal.inProgress"
                class="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {{ deleteModal.inProgress ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import type { User } from '../domain/User'

// ─── Types ───

interface AdminWriting {
  id: string
  userId: string
  title: string
  bodyPreview: string
  visibility: 'private' | 'shared' | 'public'
  createdAt: string
  updatedAt: string
}

interface AdminComment {
  id: string
  writingId: string
  userId: string
  contentPreview: string
  content: string
  createdAt: string
  updatedAt: string
  writingTitle: string | null
}

interface AdminAppreciation {
  id: string
  writingId: string
  userId: string
  reactionType: string
  createdAt: string
  writingTitle: string | null
}

interface UserContent {
  writings: AdminWriting[]
  comments: AdminComment[]
  appreciations: AdminAppreciation[]
}

interface DeleteModalState {
  title: string
  message: string
  detail?: string
  subDetail?: string
  warning: string
  onConfirm: () => Promise<void>
  inProgress: boolean
}

interface UserListResponse {
  data: User[]
  meta: { total: number; limit: number; offset: number }
}

// Analytics types
interface TypeCount { activityType: string; count: number }
interface ActionCount { action: string; count: number }
interface DailyActivity { date: string; total: number; authenticated: number; anonymous: number }
interface HourlyActivity { hour: number; count: number }
interface AnonVsAuth { total: number; authenticated: number; anonymous: number; uniqueUsers: number }
interface TopUser { userId: string; displayName: string; count: number }
interface TopWriting { resourceId: string; title: string; count: number; uniqueVisitors: number }
interface RecentEvent {
  id: string; userId: string | null; userDisplayName: string | null
  activityType: string; action: string; resourceType: string | null
  resourceId: string | null; details: Record<string, unknown> | null
  ipAddress: string | null; createdAt: string
}
interface UsageStats {
  total: number
  byType: TypeCount[]
  byAction: ActionCount[]
  daily: DailyActivity[]
  hourly: HourlyActivity[]
  anonVsAuth: AnonVsAuth
  topUsers: TopUser[]
  topWritings: TopWriting[]
  recentActivity: RecentEvent[]
}

// ─── State ───

const { user: currentUser } = useAuth()
const currentUserId = computed(() => currentUser.value?.id)

const users = ref<User[]>([])
const totalUsers = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const actionInProgress = ref<string | null>(null)
const feedbackMessage = ref<string | null>(null)
const feedbackType = ref<'success' | 'error'>('success')

// Expanded user state
const expandedUserId = ref<string | null>(null)
const contentLoading = ref(false)
const userContent = ref<UserContent | null>(null)

// Delete modal
const deleteModal = ref<DeleteModalState | null>(null)

// Analytics state
const stats = ref<UsageStats | null>(null)
const statsLoading = ref(true)
const statsError = ref<string | null>(null)

// ─── Computed ───

const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const activeCount = computed(() => users.value.filter(u => u.status === 'active').length)
const suspendedCount = computed(() => users.value.filter(u => u.status === 'suspended').length)

// Analytics computed
const maxTypeCount = computed(() => stats.value ? Math.max(...stats.value.byType.map(t => t.count), 1) : 1)
const maxDailyCount = computed(() => stats.value ? Math.max(...stats.value.daily.map(d => d.total), 1) : 1)
const maxHourlyCount = computed(() => stats.value ? Math.max(...stats.value.hourly.map(h => h.count), 1) : 1)
const authPct = computed(() => {
  if (!stats.value || stats.value.total === 0) return 0
  return Math.round((stats.value.anonVsAuth.authenticated / stats.value.total) * 100)
})
const anonPct = computed(() => {
  if (!stats.value || stats.value.total === 0) return 0
  return 100 - authPct.value
})
const authDonut = computed(() => {
  const circumference = 2 * Math.PI * 50 // r=50
  if (!stats.value || stats.value.total === 0) {
    return { authDash: `0 ${circumference}`, anonDash: `0 ${circumference}`, anonOffset: '0' }
  }
  const authFrac = stats.value.anonVsAuth.authenticated / stats.value.total
  const anonFrac = stats.value.anonVsAuth.anonymous / stats.value.total
  const authLen = authFrac * circumference
  const anonLen = anonFrac * circumference
  return {
    authDash: `${authLen} ${circumference - authLen}`,
    anonDash: `${anonLen} ${circumference - anonLen}`,
    anonOffset: String(authLen)
  }
})

// ─── Helpers ───

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const reactionEmoji = (type: string): string => {
  const map: Record<string, string> = {
    like: '\u{1F44D}',
    love: '\u{2764}\u{FE0F}',
    laugh: '\u{1F602}',
    wow: '\u{1F62E}',
    sad: '\u{1F622}',
    angry: '\u{1F621}'
  }
  return map[type] || '\u{1F44D}'
}

const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
  feedbackMessage.value = message
  feedbackType.value = type
  setTimeout(() => {
    feedbackMessage.value = null
  }, 3000)
}

// Analytics helpers
const barWidth = (value: number, max: number): number => max > 0 ? Math.max((value / max) * 100, 2) : 0
const barHeight = (value: number, max: number): number => max > 0 ? Math.max((value / max) * 160, 2) : 0

const typeColor = (type: string): string => {
  const colors: Record<string, string> = {
    auth: 'bg-blue-500',
    writing: 'bg-emerald-500',
    view: 'bg-sky-400',
    comment: 'bg-violet-500',
    appreciation: 'bg-pink-500',
    theme: 'bg-amber-500',
    profile: 'bg-teal-500',
    admin: 'bg-red-500'
  }
  return colors[type] || 'bg-gray-400'
}

const typeDotColor = (type: string): string => {
  const colors: Record<string, string> = {
    auth: 'bg-blue-500',
    writing: 'bg-emerald-500',
    view: 'bg-sky-400',
    comment: 'bg-violet-500',
    appreciation: 'bg-pink-500',
    theme: 'bg-amber-500',
    profile: 'bg-teal-500',
    admin: 'bg-red-500'
  }
  return colors[type] || 'bg-gray-400'
}

const hourColor = (count: number, max: number): string => {
  if (max === 0) return 'bg-gray-200'
  const ratio = count / max
  if (ratio > 0.75) return 'bg-blue-600'
  if (ratio > 0.5) return 'bg-blue-500'
  if (ratio > 0.25) return 'bg-blue-400'
  if (ratio > 0) return 'bg-blue-300'
  return 'bg-gray-200'
}

const formatHour = (h: number): string => {
  if (h === 0) return '12a'
  if (h < 12) return `${h}a`
  if (h === 12) return '12p'
  return `${h - 12}p`
}

const formatShortDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatAxisDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const formatRelativeTime = (dateStr: string): string => {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatShortDate(dateStr)
}

const actionPillClass = (action: string): string => {
  const classes: Record<string, string> = {
    create: 'bg-green-50 text-green-700 border-green-200',
    update: 'bg-blue-50 text-blue-700 border-blue-200',
    delete: 'bg-red-50 text-red-700 border-red-200',
    view: 'bg-sky-50 text-sky-700 border-sky-200',
    login: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    signup: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    logout: 'bg-gray-50 text-gray-700 border-gray-200',
    remove: 'bg-orange-50 text-orange-700 border-orange-200',
    token_refresh: 'bg-purple-50 text-purple-700 border-purple-200'
  }
  return classes[action] || 'bg-gray-50 text-gray-700 border-gray-200'
}

// ─── Data loading ───

const loadUsers = async () => {
  try {
    loading.value = true
    error.value = null
    const response = await api.get<UserListResponse>('/admin/users')
    users.value = response.data
    totalUsers.value = response.meta.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load users'
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    statsLoading.value = true
    statsError.value = null
    const response = await api.get<{ data: UsageStats }>('/admin/stats')
    stats.value = response.data
  } catch (err) {
    statsError.value = err instanceof Error ? err.message : 'Failed to load analytics'
  } finally {
    statsLoading.value = false
  }
}

const loadUserContent = async (userId: string) => {
  try {
    contentLoading.value = true
    const response = await api.get<{ data: UserContent }>(`/admin/users/${userId}/content`)
    userContent.value = response.data
  } catch (err) {
    showFeedback(err instanceof Error ? err.message : 'Failed to load user content', 'error')
    userContent.value = null
  } finally {
    contentLoading.value = false
  }
}

const toggleExpand = (userId: string) => {
  if (expandedUserId.value === userId) {
    expandedUserId.value = null
    userContent.value = null
  } else {
    expandedUserId.value = userId
    userContent.value = null
    loadUserContent(userId)
  }
}

// ─── User actions ───

const toggleRole = async (u: User) => {
  try {
    actionInProgress.value = u.id
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    await api.put(`/admin/users/${u.id}`, { role: newRole })
    u.role = newRole
    showFeedback(`${u.displayName} is now ${newRole === 'admin' ? 'an admin' : 'a regular user'}`)
  } catch (err) {
    showFeedback(err instanceof Error ? err.message : 'Failed to update role', 'error')
  } finally {
    actionInProgress.value = null
  }
}

const toggleStatus = async (u: User) => {
  try {
    actionInProgress.value = u.id
    const newStatus = u.status === 'active' ? 'suspended' : 'active'
    await api.put(`/admin/users/${u.id}`, { status: newStatus })
    u.status = newStatus
    showFeedback(`${u.displayName} is now ${newStatus}`)
  } catch (err) {
    showFeedback(err instanceof Error ? err.message : 'Failed to update status', 'error')
  } finally {
    actionInProgress.value = null
  }
}

// ─── Writing actions ───

const changeWritingVisibility = async (w: AdminWriting, newVisibility: string) => {
  const oldVisibility = w.visibility
  try {
    actionInProgress.value = w.id
    await api.put(`/admin/writings/${w.id}/visibility`, { visibility: newVisibility })
    w.visibility = newVisibility as AdminWriting['visibility']
    showFeedback(`"${w.title}" visibility changed to ${newVisibility}`)
  } catch (err) {
    w.visibility = oldVisibility // revert on failure
    showFeedback(err instanceof Error ? err.message : 'Failed to update visibility', 'error')
  } finally {
    actionInProgress.value = null
  }
}

// ─── Delete confirmations ───

const confirmDeleteUser = (u: User) => {
  deleteModal.value = {
    title: 'Delete User',
    message: 'Are you sure you want to delete this user?',
    detail: u.displayName,
    subDetail: u.email,
    warning: 'This will permanently delete the user and all their associated data (writings, themes, comments, appreciations).',
    inProgress: false,
    onConfirm: async () => {
      deleteModal.value!.inProgress = true
      try {
        await api.delete(`/admin/users/${u.id}`)
        users.value = users.value.filter(x => x.id !== u.id)
        totalUsers.value--
        if (expandedUserId.value === u.id) {
          expandedUserId.value = null
          userContent.value = null
        }
        deleteModal.value = null
        showFeedback(`${u.displayName} has been deleted`)
      } catch (err) {
        deleteModal.value!.inProgress = false
        showFeedback(err instanceof Error ? err.message : 'Failed to delete user', 'error')
      }
    }
  }
}

const confirmDeleteWriting = (w: AdminWriting) => {
  deleteModal.value = {
    title: 'Delete Essay',
    message: 'Are you sure you want to delete this essay?',
    detail: w.title,
    warning: 'This will permanently delete the essay and all its comments and appreciations.',
    inProgress: false,
    onConfirm: async () => {
      deleteModal.value!.inProgress = true
      try {
        await api.delete(`/admin/writings/${w.id}`)
        if (userContent.value) {
          userContent.value.writings = userContent.value.writings.filter(x => x.id !== w.id)
          // Also remove comments/appreciations linked to this writing
          userContent.value.comments = userContent.value.comments.filter(c => c.writingId !== w.id)
          userContent.value.appreciations = userContent.value.appreciations.filter(a => a.writingId !== w.id)
        }
        deleteModal.value = null
        showFeedback(`"${w.title}" has been deleted`)
      } catch (err) {
        deleteModal.value!.inProgress = false
        showFeedback(err instanceof Error ? err.message : 'Failed to delete essay', 'error')
      }
    }
  }
}

const confirmDeleteComment = (c: AdminComment) => {
  deleteModal.value = {
    title: 'Delete Comment',
    message: 'Are you sure you want to delete this comment?',
    detail: c.content.substring(0, 100) + (c.content.length > 100 ? '...' : ''),
    subDetail: c.writingTitle ? `On: ${c.writingTitle}` : undefined,
    warning: 'This action cannot be undone.',
    inProgress: false,
    onConfirm: async () => {
      deleteModal.value!.inProgress = true
      try {
        await api.delete(`/admin/comments/${c.id}`)
        if (userContent.value) {
          userContent.value.comments = userContent.value.comments.filter(x => x.id !== c.id)
        }
        deleteModal.value = null
        showFeedback('Comment deleted')
      } catch (err) {
        deleteModal.value!.inProgress = false
        showFeedback(err instanceof Error ? err.message : 'Failed to delete comment', 'error')
      }
    }
  }
}

const confirmDeleteAppreciation = (a: AdminAppreciation) => {
  deleteModal.value = {
    title: 'Delete Appreciation',
    message: `Remove this ${a.reactionType} reaction?`,
    subDetail: a.writingTitle ? `On: ${a.writingTitle}` : undefined,
    warning: 'This action cannot be undone.',
    inProgress: false,
    onConfirm: async () => {
      deleteModal.value!.inProgress = true
      try {
        await api.delete(`/admin/appreciations/${a.id}`)
        if (userContent.value) {
          userContent.value.appreciations = userContent.value.appreciations.filter(x => x.id !== a.id)
        }
        deleteModal.value = null
        showFeedback('Appreciation deleted')
      } catch (err) {
        deleteModal.value!.inProgress = false
        showFeedback(err instanceof Error ? err.message : 'Failed to delete appreciation', 'error')
      }
    }
  }
}

const executeDelete = () => {
  if (deleteModal.value?.onConfirm) {
    deleteModal.value.onConfirm()
  }
}

// ─── Init ───

onMounted(() => {
  loadUsers()
  loadStats()
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
