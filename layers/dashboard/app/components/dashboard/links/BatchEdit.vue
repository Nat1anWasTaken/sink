<script setup lang="ts">
import type { Link, LinkBatchEditResponse, LinkBatchEditUpdates } from '@/types'
import { Loader } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

type OptionMode = 'skip' | 'set' | 'clear'
type ToggleMode = 'no-change' | 'enable' | 'disable' | 'clear'

const props = defineProps<{
  slugs: string[]
}>()

const emit = defineEmits<{
  success: [links: Link[]]
}>()

const { t } = useI18n()

const dialogOpen = ref(false)
const pending = ref(false)

const commentMode = ref<OptionMode>('skip')
const comment = ref('')

const passwordMode = ref<OptionMode>('skip')
const password = ref('')

const cloakingMode = ref<ToggleMode>('no-change')
const redirectWithQueryMode = ref<ToggleMode>('no-change')

const hasChanges = computed(() => {
  return commentMode.value !== 'skip'
    || passwordMode.value !== 'skip'
    || cloakingMode.value !== 'no-change'
    || redirectWithQueryMode.value !== 'no-change'
})

const canSubmit = computed(() => {
  if (!props.slugs.length || !hasChanges.value || pending.value)
    return false

  if (commentMode.value === 'set' && !comment.value.trim())
    return false

  if (passwordMode.value === 'set' && !password.value.trim())
    return false

  return true
})

function parseOptionMode(value: string | number | bigint | Record<string, unknown> | null, fallback: OptionMode): OptionMode {
  if (value === 'skip' || value === 'set' || value === 'clear')
    return value
  return fallback
}

function parseToggleMode(value: string | number | bigint | Record<string, unknown> | null, fallback: ToggleMode): ToggleMode {
  if (value === 'no-change' || value === 'enable' || value === 'disable' || value === 'clear')
    return value
  return fallback
}

function resolveBooleanToggle(mode: ToggleMode): boolean | null | undefined {
  if (mode === 'enable')
    return true
  if (mode === 'disable')
    return false
  if (mode === 'clear')
    return null
  return undefined
}

function buildUpdates(): LinkBatchEditUpdates {
  const updates: LinkBatchEditUpdates = {}

  if (commentMode.value === 'clear')
    updates.comment = null
  else if (commentMode.value === 'set')
    updates.comment = comment.value.trim()

  if (passwordMode.value === 'clear')
    updates.password = null
  else if (passwordMode.value === 'set')
    updates.password = password.value.trim()

  const cloaking = resolveBooleanToggle(cloakingMode.value)
  if (cloaking !== undefined)
    updates.cloaking = cloaking

  const redirectWithQuery = resolveBooleanToggle(redirectWithQueryMode.value)
  if (redirectWithQuery !== undefined)
    updates.redirectWithQuery = redirectWithQuery

  return updates
}

function resetForm() {
  commentMode.value = 'skip'
  comment.value = ''
  passwordMode.value = 'skip'
  password.value = ''
  cloakingMode.value = 'no-change'
  redirectWithQueryMode.value = 'no-change'
}

watch(dialogOpen, (open) => {
  if (!open)
    resetForm()
})

async function submitBatchEdit() {
  if (!canSubmit.value)
    return

  pending.value = true
  try {
    const result = await useAPI<LinkBatchEditResponse>('/api/link/batch-edit', {
      method: 'PUT',
      body: {
        slugs: props.slugs,
        updates: buildUpdates(),
      },
    })

    if (result.updated > 0) {
      emit('success', result.links)
      toast(t('links.batch.update_success', { count: result.updated }))
    }

    if (result.failed > 0) {
      toast.error(t('links.batch.update_partial', { count: result.failed }))
    }

    dialogOpen.value = false
  }
  catch (error) {
    console.error(error)
    toast.error(t('links.batch.update_failed'), {
      description: error instanceof Error ? error.message : String(error),
    })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <ResponsiveModal
    v-model:open="dialogOpen"
    :title="$t('links.batch.title')"
  >
    <template #trigger>
      <slot>
        <Button
          :disabled="!slugs.length"
        >
          {{ $t('links.batch.edit_selected', { count: slugs.length }) }}
        </Button>
      </slot>
    </template>

    <div class="space-y-4 px-1">
      <p class="text-sm text-muted-foreground">
        {{ $t('links.batch.description', { count: slugs.length }) }}
      </p>

      <FieldGroup>
        <Field>
          <FieldLabel>{{ $t('links.batch.comment') }}</FieldLabel>
          <Select :model-value="commentMode" @update:model-value="commentMode = parseOptionMode($event, 'skip')">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">
                {{ $t('links.batch.skip') }}
              </SelectItem>
              <SelectItem value="set">
                {{ $t('links.batch.set_value') }}
              </SelectItem>
              <SelectItem value="clear">
                {{ $t('links.batch.clear_value') }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            v-if="commentMode === 'set'"
            v-model="comment"
            class="mt-1.5"
            :placeholder="$t('links.form.comment')"
          />
        </Field>

        <Field>
          <FieldLabel>{{ $t('links.form.password_label') }}</FieldLabel>
          <Select :model-value="passwordMode" @update:model-value="passwordMode = parseOptionMode($event, 'skip')">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">
                {{ $t('links.batch.skip') }}
              </SelectItem>
              <SelectItem value="set">
                {{ $t('links.batch.set_value') }}
              </SelectItem>
              <SelectItem value="clear">
                {{ $t('links.batch.clear_value') }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-if="passwordMode === 'set'"
            v-model="password"
            class="mt-1.5"
            :placeholder="$t('links.form.password_placeholder')"
            autocomplete="off"
          />
        </Field>

        <Field>
          <FieldLabel>{{ $t('links.form.cloaking_label') }}</FieldLabel>
          <Select :model-value="cloakingMode" @update:model-value="cloakingMode = parseToggleMode($event, 'no-change')">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-change">
                {{ $t('links.batch.no_change') }}
              </SelectItem>
              <SelectItem value="enable">
                {{ $t('links.batch.enable') }}
              </SelectItem>
              <SelectItem value="disable">
                {{ $t('links.batch.disable') }}
              </SelectItem>
              <SelectItem value="clear">
                {{ $t('links.batch.clear_value') }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>{{ $t('links.form.redirect_with_query_label') }}</FieldLabel>
          <Select :model-value="redirectWithQueryMode" @update:model-value="redirectWithQueryMode = parseToggleMode($event, 'no-change')">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-change">
                {{ $t('links.batch.no_change') }}
              </SelectItem>
              <SelectItem value="enable">
                {{ $t('links.batch.enable') }}
              </SelectItem>
              <SelectItem value="disable">
                {{ $t('links.batch.disable') }}
              </SelectItem>
              <SelectItem value="clear">
                {{ $t('links.batch.clear_value') }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </div>

    <template #footer>
      <Button
        type="button"
        variant="secondary"
        @click="dialogOpen = false"
      >
        {{ $t('common.close') }}
      </Button>
      <Button
        type="button"
        :disabled="!canSubmit"
        @click="submitBatchEdit"
      >
        <Loader
          v-if="pending"
          class="mr-2 h-4 w-4 animate-spin"
        />
        {{ $t('links.batch.apply') }}
      </Button>
    </template>
  </ResponsiveModal>
</template>
