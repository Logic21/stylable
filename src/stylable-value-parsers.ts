import * as postcss from 'postcss';
import { Diagnostics } from './diagnostics';
import { processPseudoStates } from './pseudo-states';
import { parseSelector } from './selector-utils';
import { SRule } from './stylable-processor';
import { StateParsedValue } from './types';

const valueParser = require('postcss-value-parser');

export interface MappedStates {
    [s: string]: StateParsedValue | string | null;
}

// TODO: remove
export interface TypedClass {
    '-st-root'?: boolean;
    '-st-states'?: string[] | MappedStates;
    '-st-extends'?: string;
    '-st-variant'?: boolean;
}

export interface MixinValue {
    type: string;
    options: Array<{ value: string }>;
}

export interface ArgValue {
    type: string;
    value: string;
}
export interface ExtendsValue {
    symbolName: string;
    args: ArgValue[][] | null;
}

export const valueMapping = {
    from: '-st-from' as '-st-from',
    named: '-st-named' as '-st-named',
    default: '-st-default' as '-st-default',
    root: '-st-root' as '-st-root',
    states: '-st-states' as '-st-states',
    extends: '-st-extends' as '-st-extends',
    mixin: '-st-mixin' as '-st-mixin',
    variant: '-st-variant' as '-st-variant',
    compose: '-st-compose' as '-st-compose',
    theme: '-st-theme' as '-st-theme',
    global: '-st-global' as '-st-global'
};

export type stKeys = keyof typeof valueMapping;

export const stValues: string[] = Object.keys(valueMapping).map((key: stKeys) => valueMapping[key]);

export const STYLABLE_VALUE_MATCHER = /^-st-/;
export const STYLABLE_NAMED_MATCHER = new RegExp(`^${valueMapping.named}-(.+)`);

export const SBTypesParsers = {
    '-st-root'(value: string) {
        return value === 'false' ? false : true;
    },
    '-st-variant'(value: string) {
        return value === 'false' ? false : true;
    },
    '-st-theme'(value: string) {
        return value === 'false' ? false : true;
    },
    '-st-global'(decl: postcss.Declaration, _diagnostics: Diagnostics) {
        // Experimental
        const selector: any = parseSelector(decl.value.replace(/^['"]/, '').replace(/['"]$/, ''));
        return selector.nodes[0].nodes;
    },
    '-st-states'(value: string, rule: SRule, _diagnostics: Diagnostics) {
        if (!value) {
            return {};
        }

        const mappedStates: MappedStates = {};
        return processPseudoStates(value, rule, _diagnostics);
    },
    '-st-extends'(value: string) {
        const ast = valueParser(value);
        const types: ExtendsValue[] = [];

        ast.walk((node: any) => {

            if (node.type === 'function') {
                const args: ArgValue[][] = [];

                if (node.nodes.length) {
                    args.push([]);
                    node.nodes.forEach((node: any) => {
                        if (node.type === 'div') {
                            args.push([]);
                        } else {
                            args[args.length - 1].push({
                                type: node.type,
                                value: node.value
                            });
                        }
                    });
                }

                types.push({
                    symbolName: node.value,
                    args
                });

                return false;

            } else if (node.type === 'word') {
                types.push({
                    symbolName: node.value,
                    args: null
                });
            }
            return undefined;
        }, false);

        return {
            ast,
            types
        };
    },
    '-st-named'(value: string) {
        const namedMap: { [key: string]: string } = {};
        if (value) {
            value.split(',').forEach(name => {
                const parts = name.trim().split(/\s+as\s+/);
                if (parts.length === 1) {
                    namedMap[parts[0]] = parts[0];
                } else if (parts.length === 2) {
                    namedMap[parts[1]] = parts[0];
                }
            });
        }
        return namedMap;
    },
    '-st-mixin'(mixinNode: postcss.Declaration, diagnostics: Diagnostics) {
        const ast = valueParser(mixinNode.value);
        const mixins: Array<{ type: string, options: Array<{ value: string }> }> = [];
        ast.nodes.forEach((node: any) => {

            if (node.type === 'function') {
                mixins.push({
                    type: node.value,
                    options: createOptions(node)
                });
            } else if (node.type === 'word') {
                mixins.push({
                    type: node.value,
                    options: []
                });
            } else if (node.type === 'string') {
                diagnostics.error(mixinNode, `value can not be a string (remove quotes?)`, { word: mixinNode.value });
            }
        });

        return mixins;

    },
    '-st-compose'(composeNode: postcss.Declaration, diagnostics: Diagnostics) {
        const ast = valueParser(composeNode.value);
        const composes: string[] = [];
        ast.walk((node: any) => {
            if (node.type === 'function') {
                // TODO
            } else if (node.type === 'word') {
                composes.push(node.value);
            } else if (node.type === 'string') {
                diagnostics.error(
                    composeNode,
                    `value can not be a string (remove quotes?)`,
                    { word: composeNode.value }
                );
            }
        });
        return composes;
    }
};

export function groupValues(node: any) {
    const grouped: any[] = [];
    let current: any[] = [];

    node.nodes.forEach((n: any) => {
        if (n.type === 'div') {
            grouped.push(current);
            current = [];
        } else {
            current.push(n);
        }
    });

    const last = grouped[grouped.length - 1];

    if ((last && last !== current && current.length) || !last && current.length) {
        grouped.push(current);
    }
    return grouped;
}

export function listOptions(node: any) {
    return groupValues(node).map((nodes: any) => valueParser.stringify(nodes, (n: any) => {
        if (n.type === 'div') {
            return null;
        } else if (n.type === 'string') {
            return n.value;
        } else {
            return undefined;
        }
    })).filter((x: string) => typeof x === 'string');
}

export function createOptions(node: any) {
    return listOptions(node).map(value => ({ value }));
}
