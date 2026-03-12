<script setup lang="ts">
import type { CounterData, Link, LinkListResponse, LinkUpdateType } from '@/types'
import { useInfiniteScroll } from '@vueuse/core'
import { Loader } from 'lucide-vue-next'

const linksStore = useDashboardLinksStore()

const links = ref<Link[]>([])
const listComplete = ref(false)
const listError = ref(false)
const limit = 24
let cursor = ''

const countersMap = ref<Record<string, CounterData>>({})
provide('linksCountersMap', countersMap)

const pendingIds = new Set<string>()
const defaultCounters: CounterData = Object.freeze({ visits: 0, visitors: 0, referers: 0 })

async function fetchCounters(ids: string[]) {
  if (!ids.length)
    return
  ids.forEach(id => pendingIds.add(id))
  try {
    const result = await useAPI<{ data: (CounterData & { id: string })[] }>('/api/stats/counters', {
      query: { id: ids.join(',') },
    })
    for (const item of result.data ?? []) {
      countersMap.value[item.id] = {
        visits: item.visits,
        visitors: item.visitors,
        referers: item.referers,
      }
    }
  }
  catch (error) {
    console.error('Failed to fetch counters:', error)
  }
  finally {
    for (const id of ids) {
      if (!countersMap.value[id])
        countersMap.value[id] = { ...defaultCounters }
      pendingIds.delete(id)
    }
  }
}

const scrollContainer = ref<HTMLElement | Window | null>(null)

onMounted(() => {
  scrollContainer.value = document.querySelector('.overflow-y-auto') as HTMLElement | null
})

const displayedLinks = computed(() => {
  const sorted = [...links.value]
  switch (linksStore.sortBy) {
    case 'newest':
      return sorted.sort((a, b) => b.createdAt - a.createdAt)
    case 'oldest':
      return sorted.sort((a, b) => a.createdAt - b.createdAt)
    case 'az':
      return sorted.sort((a, b) => a.slug.localeCompare(b.slug))
    case 'za':
      return sorted.sort((a, b) => b.slug.localeCompare(a.slug))
    default:
      return sorted
  }
})

const selectedSlugsSet = computed(() => new Set(linksStore.selectedSlugs))
const allLoadedSelected = computed(() => {
  if (!links.value.length)
    return false
  return links.value.every(link => selectedSlugsSet.value.has(link.slug))
})

async function getLinks() {
  try {
    const data = await useAPI<LinkListResponse>('/api/link/list', {
      query: {
        limit,
        cursor,
      },
    })
    const newLinks = data.links.filter(Boolean)
    links.value = links.value.concat(newLinks)
    cursor = data.cursor
    listComplete.value = data.list_complete
    listError.value = false

    const ids = newLinks.map(l => l.id).filter(id => !countersMap.value[id] && !pendingIds.has(id))
    fetchCounters(ids)
  }
  catch (error) {
    console.error(error)
    listError.value = true
  }
}

const { isLoading } = useInfiniteScroll(
  scrollContainer as unknown as Ref<HTMLElement | null>,
  getLinks,
  {
    distance: 150,
    interval: 1000,
    canLoadMore: () => {
      return !listError.value && !listComplete.value
    },
  },
)

function updateLinkList(link: Link, type: LinkUpdateType) {
  if (type === 'edit') {
    const index = links.value.findIndex(l => l.id === link.id)
    if (index !== -1)
      links.value[index] = link
  }
  else if (type === 'delete') {
    const index = links.value.findIndex(l => l.id === link.id)
    if (index !== -1)
      links.value.splice(index, 1)
    linksStore.removeSelectedSlug(link.slug)
  }
  else {
    links.value.unshift(link)
    linksStore.sortBy = 'newest'
  }
}

function toggleLoadedSelection() {
  if (allLoadedSelected.value) {
    const loadedSlugs = new Set(links.value.map(link => link.slug))
    linksStore.setSelectedSlugs(
      linksStore.selectedSlugs.filter(slug => !loadedSlugs.has(slug)),
    )
    return
  }

  linksStore.setSelectedSlugs([
    ...linksStore.selectedSlugs,
    ...links.value.map(link => link.slug),
  ])
}

function handleBatchEditSuccess(updatedLinks: Link[]) {
  for (const link of updatedLinks) {
    updateLinkList(link, 'edit')
  }
  linksStore.clearSelectedSlugs()
  linksStore.setBulkEditMode(false)
}

linksStore.onLinkUpdate(({ link, type }) => {
  updateLinkList(link, type)
})
</script>

<template>
  <div class="mb-4 flex flex-wrap items-center gap-2">
    <Button
      variant="outline"
      @click="linksStore.toggleBulkEditMode"
    >
      {{ linksStore.bulkEditMode ? $t('links.batch.exit_mode') : $t('links.batch.enter_mode') }}
    </Button>

    <template v-if="linksStore.bulkEditMode">
      <Badge variant="secondary">
        {{ $t('links.batch.selected_count', { count: linksStore.selectedSlugs.length }) }}
      </Badge>

      <Button
        variant="outline"
        :disabled="!links.length"
        @click="toggleLoadedSelection"
      >
        {{ allLoadedSelected ? $t('links.batch.unselect_loaded') : $t('links.batch.select_loaded') }}
      </Button>

      <Button
        variant="ghost"
        :disabled="!linksStore.selectedSlugs.length"
        @click="linksStore.clearSelectedSlugs"
      >
        {{ $t('links.batch.clear_selected') }}
      </Button>

      <DashboardLinksBatchEdit
        :slugs="linksStore.selectedSlugs"
        @success="handleBatchEditSuccess"
      />
    </template>
  </div>

  <section
    class="
      grid grid-cols-1 gap-4
      md:grid-cols-2
      lg:grid-cols-3
    "
  >
    <DashboardLinksLink
      v-for="link in displayedLinks"
      :key="link.id"
      :link="link"
      :bulk-mode="linksStore.bulkEditMode"
      :selected="selectedSlugsSet.has(link.slug)"
      @toggle-select="linksStore.toggleSlugSelection(link.slug)"
    />
  </section>
  <div
    v-if="isLoading"
    class="flex items-center justify-center"
  >
    <Loader class="animate-spin" />
  </div>
  <div
    v-if="!isLoading && listComplete"
    class="flex items-center justify-center text-sm"
  >
    {{ $t('links.no_more') }}
  </div>
  <div
    v-if="listError"
    class="flex items-center justify-center text-sm"
  >
    {{ $t('links.load_failed') }}
    <Button variant="link" @click="getLinks">
      {{ $t('common.try_again') }}
    </Button>
  </div>
</template>
