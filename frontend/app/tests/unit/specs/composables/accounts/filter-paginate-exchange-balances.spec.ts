import flushPromises from 'flush-promises';
import { afterEach, assertType, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { MaybeRef } from '@vueuse/core';
import type { ExchangeSavingsCollection, ExchangeSavingsEvent, ExchangeSavingsRequestPayload } from '@/types/exchanges';
import type Vue from 'vue';

vi.mock('vue-router', () => {
  const route = ref({
    query: {},
  });
  return {
    useRoute: vi.fn().mockReturnValue(route),
    useRouter: vi.fn().mockReturnValue({
      push: vi.fn(({ query }) => {
        set(route, { query });
        return true;
      }),
    }),
  };
});

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof Vue>('vue');

  return {
    ...mod,
    onBeforeMount: vi.fn().mockImplementation((fn: () => void) => fn()),
  };
});

describe('composables::history/filter-paginate', () => {
  let fetchExchangeSavings: (payload: MaybeRef<ExchangeSavingsRequestPayload>) => Promise<ExchangeSavingsCollection>;
  const exchange = ref<string>('binance');
  const mainPage = ref<boolean>(false);
  const router = useRouter();
  const route = useRoute();

  beforeAll(() => {
    setActivePinia(createPinia());
    fetchExchangeSavings = useExchangeBalancesStore().fetchExchangeSavings;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('components::exchanges/BinanceSavingDetail.vue', () => {
    const defaultParams = computed(() => ({
      location: get(exchange).toString(),
    }));

    const defaultCollectionState = (): ExchangeSavingsCollection => ({
      found: 0,
      limit: 0,
      data: [],
      total: 0,
      totalUsdValue: Zero,
      assets: [],
      received: [],
    });

    beforeEach(() => {
      set(mainPage, true);
    });

    it('initialize composable correctly', async () => {
      const { userAction, filters, sort, state, fetchData, applyRouteFilter, isLoading } = usePaginationFilters<
        ExchangeSavingsEvent,
        ExchangeSavingsRequestPayload,
        ExchangeSavingsEvent,
        ExchangeSavingsCollection
      >(fetchExchangeSavings, {
        history: get(mainPage) ? 'router' : false,
        locationOverview: exchange,
        defaultCollection: defaultCollectionState,
        defaultParams,
        defaultSortBy: {
          ascending: [true],
        },
      });

      expect(get(userAction)).toBe(true);
      expect(get(isLoading)).toBe(false);
      expect(get(filters)).to.toStrictEqual(undefined);
      expect(get(sort)).toHaveLength(1);
      expect(get(sort)).toMatchObject([
        {
          column: 'timestamp',
          direction: 'asc',
        },
      ]);
      expect(get(state).data).toHaveLength(0);
      expect(get(state).assets).toHaveLength(0);
      expect(get(state).received).toHaveLength(0);
      expect(get(state).total).toEqual(0);

      set(userAction, true);
      applyRouteFilter();
      fetchData().catch(() => {});
      expect(get(isLoading)).toBe(true);
      await flushPromises();
      await flushPromises();
      expect(get(isLoading)).toBe(false);
      expect(get(state).total).toEqual(260);
    });

    it('check the return types', () => {
      const { isLoading, state, filters, matchers } = usePaginationFilters<
        ExchangeSavingsEvent,
        ExchangeSavingsRequestPayload,
        ExchangeSavingsEvent,
        ExchangeSavingsCollection
      >(fetchExchangeSavings, {
        history: get(mainPage) ? 'router' : false,
        locationOverview: exchange,
        defaultCollection: defaultCollectionState,
        defaultParams,
        defaultSortBy: {
          ascending: [true],
        },
      });

      expect(get(isLoading)).toBe(false);

      expectTypeOf(get(state)).toEqualTypeOf<ExchangeSavingsCollection>();
      expectTypeOf(get(state).data).toEqualTypeOf<ExchangeSavingsEvent[]>();
      expectTypeOf(get(state).found).toEqualTypeOf<number>();
      expectTypeOf(get(filters)).toEqualTypeOf<undefined>();
      expectTypeOf(get(matchers)).toEqualTypeOf<undefined[]>();
    });

    it('modify filters and fetch data correctly', async () => {
      const pushSpy = vi.spyOn(router, 'push');
      const query = { sortDesc: ['false'] };

      const { isLoading, state } = usePaginationFilters<
        ExchangeSavingsEvent,
        ExchangeSavingsRequestPayload,
        ExchangeSavingsEvent,
        ExchangeSavingsCollection
      >(fetchExchangeSavings, {
        history: get(mainPage) ? 'router' : false,
        locationOverview: exchange,
        defaultCollection: defaultCollectionState,
        defaultParams,
        defaultSortBy: {
          ascending: [false],
        },
      });

      await router.push({
        query,
      });

      expect(pushSpy).toHaveBeenCalledOnce();
      expect(pushSpy).toHaveBeenCalledWith({ query });
      expect(get(route).query).toEqual(query);
      expect(get(isLoading)).toBe(true);
      await flushPromises();
      expect(get(isLoading)).toBe(false);

      assertType<ExchangeSavingsCollection>(get(state));
      assertType<ExchangeSavingsEvent[]>(get(state).data);
      assertType<number>(get(state).found);

      expect(get(state).data).toHaveLength(10);
      expect(get(state).assets).toHaveLength(2);
      expect(get(state).received).toHaveLength(2);
      expect(get(state).found).toEqual(260);
      expect(get(state).total).toEqual(260);
    });
  });
});
