<template>
  <div>
    <v-button
        :loading="b1l"
        @click="generateEventTypeSuggestions"
        class="space"
    >
      Reload type suggestions
    </v-button>
    <v-button @click="generatePrezo" :loading="b2l">Reload prezo</v-button>
  </div>
</template>

<script setup lang="ts">
import { useApi, useStores } from '@directus/extensions-sdk';
import { ref } from 'vue';

const props = defineProps<{
  primaryKey: string;
}>();

const api = useApi();
const { useNotificationsStore } = useStores();

const b1l = ref(false);
const b2l = ref(false);

const generateEventTypeSuggestions = async () => {
  b1l.value = true;
  try {
    await api.patch(`/actions/${props.primaryKey}/generateEventTypeSuggestions`);
    useNotificationsStore().add({
      title: 'Success',
      type: 'success',
    });
  } catch (e) {
    useNotificationsStore().add({
      title: 'Error',
      error: e,
      dialog: true,
      type: 'error',
    });
  }
  b1l.value = false;
};

const generatePrezo = async () => {
  b2l.value = true;
  try {
    await api.patch(`/actions/${props.primaryKey}/generatePrezo`);
    useNotificationsStore().add({
      title: 'Success',
      type: 'success',
    });
  } catch (e) {
    useNotificationsStore().add({
      title: 'Error',
      error: e,
      dialog: true,
      type: 'error',
    });
  }
  b2l.value = false;
};
</script>

<style scoped>
.space {
  margin-right: 10px;
}
</style>
