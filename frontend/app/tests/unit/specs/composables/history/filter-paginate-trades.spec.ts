import flushPromises from 'flush-promises';
import { afterEach, assertType, beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type Vue from 'vue';
import type { MaybeRef } from '@vueuse/core';
import type { Collection } from '@/types/collection';
import type { LocationQuery } from '@/types/route';
import type { Filters, Matcher } from '@/composables/filters/trades';
import type { Trade, TradeEntry, TradeRequestPayload } from '@/types/history/trade';

vi.mock('vue-router', () => {
  const route = ref({
    query: ref({}),
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
  let fetchTrades: (payload: MaybeRef<TradeRequestPayload>) => Promise<Collection<TradeEntry>>;
  const locationOverview = ref<string>('');
  const mainPage = ref<boolean>(false);
  const router = useRouter();
  const route = useRoute();

  beforeAll(() => {
    setActivePinia(createPinia());
    fetchTrades = useTrades().fetchTrades;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('components::history/trades/ClosedTrades', () => {
    set(locationOverview, '');
    const hideIgnoredTrades = ref(false);
    const extraParams = computed(() => ({
      includeIgnoredTrades: (!get(hideIgnoredTrades)).toString(),
    }));

    const onUpdateFilters = (query: LocationQuery) => {
      set(hideIgnoredTrades, query.includeIgnoredTrades === 'false');
    };

    beforeEach(() => {
      set(mainPage, true);
    });

    it('initialize composable correctly', async () => {
      const { userAction, filters, sort, state, fetchData, applyRouteFilter, isLoading } = usePaginationFilters<
        Trade,
        TradeRequestPayload,
        TradeEntry,
        Collection<TradeEntry>,
        Filters,
        Matcher
      >(fetchTrades, {
        history: get(mainPage) ? 'router' : false,
        filterSchema: useTradeFilters,
        locationOverview,
        onUpdateFilters,
        extraParams,
      });

      expect(get(userAction)).toBe(true);
      expect(get(isLoading)).toBe(false);
      expect(get(filters)).to.toStrictEqual({});
      expect(Array.isArray(get(sort))).toBe(true);
      expect(get(sort)).toHaveLength(1);
      expect(get(state).data).toHaveLength(0);
      expect(get(state).total).toEqual(0);

      set(userAction, true);
      applyRouteFilter();
      fetchData().catch(() => {});
      expect(get(isLoading)).toBe(true);
      await flushPromises();
      expect(get(state).total).toEqual(210);
    });

    it('check the return types', () => {
      const { isLoading, state, filters, matchers } = usePaginationFilters<
        Trade,
        TradeRequestPayload,
        TradeEntry,
        Collection<TradeEntry>,
        Filters,
        Matcher
      >(fetchTrades, {
        history: get(mainPage) ? 'router' : false,
        filterSchema: useTradeFilters,
        locationOverview,
        onUpdateFilters,
        extraParams,
      });

      expect(get(isLoading)).toBe(false);

      expectTypeOf(get(state)).toEqualTypeOf<Collection<TradeEntry>>();
      expectTypeOf(get(state).data).toEqualTypeOf<TradeEntry[]>();
      expectTypeOf(get(state).found).toEqualTypeOf<number>();
      expectTypeOf(get(filters)).toEqualTypeOf<Filters>();
      expectTypeOf(get(matchers)).toEqualTypeOf<Matcher[]>();
    });

    it('modify filters and fetch data correctly', async () => {
      const pushSpy = vi.spyOn(router, 'push');
      const query = { sortBy: ['type'], sortDesc: ['true'] };

      const { isLoading, state } = usePaginationFilters<
        Trade,
        TradeRequestPayload,
        TradeEntry,
        Collection<TradeEntry>,
        Filters,
        Matcher
      >(fetchTrades, {
        history: get(mainPage) ? 'router' : false,
        filterSchema: useTradeFilters,
        locationOverview,
        onUpdateFilters,
        extraParams,
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

      assertType<Collection<TradeEntry>>(get(state));
      assertType<TradeEntry[]>(get(state).data);
      assertType<number>(get(state).found);

      expect(get(state).data).toHaveLength(10);
      expect(get(state).found).toEqual(210);
      expect(get(state).limit).toEqual(-1);
      expect(get(state).total).toEqual(210);
    });
  });
});
