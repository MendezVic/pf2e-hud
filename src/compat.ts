import { EncounterPF2e, ItemPF2e, OneToTen, R, RolledCombatant } from "foundry-helpers";

class SYSTEM {
    static get id(): "pf2e" | "sf2e" {
        return game.system.id as "pf2e" | "sf2e";
    }

    static get oppositeId(): "pf2e" | "sf2e" {
        return this.id === "pf2e" ? "sf2e" : "pf2e";
    }

    static get anachronismId(): "pf2e-anachronism" | "sf2e-anachronism" {
        return `${this.oppositeId}-anachronism`;
    }

    static get isPF2e(): boolean {
        return this.id === "pf2e";
    }

    static get isSF2e(): boolean {
        return this.id === "sf2e";
    }

    static relativePath(...path: string[]): string {
        return `systems/${this.id}/${R.join(path, "/")}`;
    }

    static path(...path: string[]): () => string {
        return () => this.relativePath(...path);
    }

    static uuid<T extends string>(pf2e: T, sf2e: T): () => T {
        return () => (this.isSF2e ? sf2e : pf2e);
    }

    static itemUuid<T extends string>(pf2e: T, sf2e: T): () => T {
        return () => (this.isSF2e ? sf2e : pf2e);
    }

    static uuids<T extends string>(uuids: [pf2e: T, sf2e: T][]): () => T[] {
        return () => {
            const index = this.isSF2e ? 1 : 0;
            return uuids.map((uuid) => uuid[index]);
        };
    }

    static fromUuid<T>(uuid: () => string): Promise<T | null> {
        return fromUuid<T>(uuid(), { strict: false });
    }

    static pack(systemPack: string, anachronismPack?: string): () => CompendiumCollection | undefined {
        return () => this.getPack(systemPack, anachronismPack);
    }

    static sluggify(text: string, options?: sluggify.Options): string {
        return game.pf2e.system.sluggify(text, options);
    }

    static getPack(systemPack: string, anachronismPack?: string): CompendiumCollection | undefined {
        const packId = this.isSF2e && anachronismPack ? anachronismPack : systemPack;
        return game.packs.get(packId);
    }

    static getSystemPack(name: string): CompendiumCollection | undefined {
        return game.packs.get(`${this.id}.${name}`);
    }

    static getAnachronismPack(name: string): CompendiumCollection | undefined {
        return game.packs.get(`${this.anachronismId}.${name}`);
    }
}

const ROMAN_RANKS = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
} as const satisfies Record<OneToTen, string>;

type RomanRank = (typeof ROMAN_RANKS)[OneToTen];

function createDuplicateMap<K, V>(entries: [K | K[], V][]): Map<K, V> {
    const map = new Map<K, V>();

    for (const [keys, value] of entries) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            map.set(key, value);
        }
    }

    return map;
}

function itemIsEquipped(item: ItemPF2e): boolean {
    const parentItem = "parentItem" in item ? item.parentItem : null;
    const itemToCheck = parentItem ?? item;
    const isInvested = "isInvested" in itemToCheck ? itemToCheck.isInvested : null;
    const isEquipped = "isEquipped" in itemToCheck ? itemToCheck.isEquipped : true;

    return isInvested === true || (isInvested === null && !!isEquipped);
}

function setInitiativeFromDrop(
    encounter: EncounterPF2e | null | undefined,
    newOrder: RolledCombatant<EncounterPF2e>[],
    dropped: RolledCombatant<EncounterPF2e>,
): void {
    const droppedIndex = newOrder.indexOf(dropped);
    const aboveDropped = newOrder[droppedIndex - 1];
    const belowDropped = newOrder[droppedIndex + 1];

    const hasAboveAndBelow = !!aboveDropped && !!belowDropped;
    const hasAboveAndNoBelow = !!aboveDropped && !belowDropped;
    const hasBelowAndNoAbove = !aboveDropped && !!belowDropped;
    const aboveIsHigherThanBelow = hasAboveAndBelow && belowDropped.initiative < aboveDropped.initiative;
    const belowIsHigherThanAbove = hasAboveAndBelow && belowDropped.initiative < aboveDropped.initiative;
    const wasDraggedUp = !!belowDropped && encounter?.getCombatantWithHigherInit(dropped, belowDropped) === belowDropped;
    const wasDraggedDown = !!aboveDropped && !wasDraggedUp;

    dropped.initiative =
        hasBelowAndNoAbove || (aboveIsHigherThanBelow && wasDraggedUp)
            ? belowDropped.initiative + 1
            : hasAboveAndNoBelow || (belowIsHigherThanAbove && wasDraggedDown)
              ? aboveDropped.initiative - 1
              : hasAboveAndBelow
                ? belowDropped.initiative
                : dropped.initiative;

    const withSameInitiative = newOrder.filter((combatant) => combatant.initiative === dropped.initiative);
    if (withSameInitiative.length > 1) {
        for (const [priority, combatant] of withSameInitiative.entries()) {
            foundry.utils.setProperty(combatant, `flags.${SYSTEM.id}.overridePriority.${dropped.initiative}`, priority);
        }
    }
}

async function saveNewInitiativeOrder(
    encounter: EncounterPF2e | null | undefined,
    newOrder: RolledCombatant<EncounterPF2e>[],
): Promise<void> {
    await encounter?.setMultipleInitiatives(
        newOrder.map((combatant) => ({
            id: combatant.id,
            value: combatant.initiative,
            overridePriority: combatant.overridePriority(combatant.initiative),
        })),
    );
}

export { createDuplicateMap, itemIsEquipped, ROMAN_RANKS, saveNewInitiativeOrder, setInitiativeFromDrop, SYSTEM };
export type { RomanRank };
