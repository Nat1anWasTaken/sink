import type { Link, LinkUpdateType } from '@/types'
import { defineStore } from '#imports'
import { createEventHook, tryOnScopeDispose } from '@vueuse/core'
import { ref } from 'vue'

export interface LinkUpdateEvent {
  link: Link
  type: LinkUpdateType
}

export const useDashboardLinksStore = defineStore('dashboard-links', () => {
  const sortBy = ref<'newest' | 'oldest' | 'az' | 'za'>('az')
  const bulkEditMode = ref(false)
  const selectedSlugs = ref<string[]>([])

  const showLinkEditor = ref(false)
  const editingLink = ref<Record<string, unknown> | null>(null)

  const linkUpdateHook = createEventHook<LinkUpdateEvent>()

  function openLinkEditor(link?: Record<string, unknown>) {
    editingLink.value = link || null
    showLinkEditor.value = true
  }

  function closeLinkEditor() {
    showLinkEditor.value = false
    editingLink.value = null
  }

  function notifyLinkUpdate(link: Link, type: LinkUpdateType) {
    linkUpdateHook.trigger({ link, type })
  }

  function setBulkEditMode(value: boolean) {
    bulkEditMode.value = value
    if (!value)
      selectedSlugs.value = []
  }

  function toggleBulkEditMode() {
    setBulkEditMode(!bulkEditMode.value)
  }

  function setSelectedSlugs(slugs: string[]) {
    selectedSlugs.value = Array.from(new Set(slugs))
  }

  function clearSelectedSlugs() {
    selectedSlugs.value = []
  }

  function toggleSlugSelection(slug: string) {
    if (selectedSlugs.value.includes(slug)) {
      selectedSlugs.value = selectedSlugs.value.filter(item => item !== slug)
      return
    }

    selectedSlugs.value = [...selectedSlugs.value, slug]
  }

  function removeSelectedSlug(slug: string) {
    selectedSlugs.value = selectedSlugs.value.filter(item => item !== slug)
  }

  function onLinkUpdate(callback: (event: LinkUpdateEvent) => void) {
    const { off } = linkUpdateHook.on(callback)
    tryOnScopeDispose(off)
    return off
  }

  return {
    sortBy,
    bulkEditMode,
    selectedSlugs,
    showLinkEditor,
    editingLink,
    setBulkEditMode,
    toggleBulkEditMode,
    setSelectedSlugs,
    clearSelectedSlugs,
    toggleSlugSelection,
    removeSelectedSlug,
    openLinkEditor,
    closeLinkEditor,
    notifyLinkUpdate,
    onLinkUpdate,
  }
})
