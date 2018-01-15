import {expect} from 'chai';
import {resolve} from 'path';
import {Diagnostics} from '../src';
import {nativeFunctionsDic, nativePseudoClasses, nativePseudoElements} from '../src/native-types';
import {reservedKeyFrames} from '../src/stylable-utils';
import {
    expectWarnings,
    expectWarningsFromTransform,
    findTestLocations
} from './utils/diagnostics';

const customButton = `
    .root{
        -st-states:shmover;
    }
    .my-part{

    }
    .my-variant{
        -st-variant:true;
        color:red;
    }

`;

describe('findTestLocations', () => {

    it('find single location 1', () => {
        const l = findTestLocations('\n  |a|');
        expect(l.start, 'start').to.eql({ line: 2, column: 3 });
        expect(l.end, 'end').to.eql({ line: 2, column: 4 });

    });

    it('find single location 2', () => {
        const l = findTestLocations('\n  |a\n  |');
        expect(l.start, 'start').to.eql({ line: 2, column: 3 });
        expect(l.end, 'end').to.eql({ line: 3, column: 3 });
    });

    it('find single location with word', () => {
        const l = findTestLocations('\n  |$a$\n  |');
        expect(l.start, 'start').to.eql({ line: 2, column: 3 });
        expect(l.end, 'end').to.eql({ line: 3, column: 3 });
        expect(l.word, 'end').to.eql('a');
    });

    it('striped css', () => {
        const css = '\n  |$a$\n  |';
        const l = findTestLocations(css);
        expect(l.css, 'start').to.eql(css.replace(/[|$]/gm, ''));
    });

});

describe('diagnostics: warnings and errors', () => {
    // TODO2: next phase
    describe('syntax', () => {

        xdescribe('selectors', () => {
            it('should return warning for unidentified tag selector', () => {
                expectWarnings(`
                    |Something| {

                    }
                `, [{ message: '"Something" component is not imported', file: 'main.css' }]);
            });

            it('should return warning for unterminated "."', () => {
                expectWarnings(`
                    .root{

                    }
                    .|
                `, [{ message: 'identifier expected', file: 'main.css' }]);
            });
            it('should return warning for unterminated ":"', () => {
                expectWarnings(`
                    .root{

                    }
                    :|
                `, [{ message: 'identifier expected', file: 'main.css' }]);
            });
            it('should return warning for className without rule area', () => {
                expectWarnings(`
                    .root{

                    }
                    .gaga|
                `, [{ message: '{ expected', file: 'main.css' }]);
            });

        });
        xdescribe('ruleset', () => {
            it('should return warning for unterminated ruleset', () => {
                expectWarnings(`
                    .root{

                    }
                    .gaga{
                        color:red|
                `, [{ message: '; expected', file: 'main.css' }]);
            });
        });
        xdescribe('rules', () => {
            it('should return warning for unterminated rule', () => {
                expectWarnings(`
                    .root{

                    }
                    .gaga{
                        color|
                    }
                `, [{ message: ': expected', file: 'main.css' }]);
                expectWarnings(`
                    .root{

                    }
                    .gaga{
                        color:|
                    }
                `, [{ message: 'property value expected', file: 'main.css' }]);
                // todo: add cases for any unterminated selectors (direct descendant, etc...)
            });
            it('should return warning for unknown rule', () => {
                expectWarnings(`
                    .root{
                        |hello|:yossi;
                    }
                `, [{ message: 'unknown rule "hello"', file: 'main.css' }]);
            });

            it('should warn when using illegal characters', () => {
                expectWarnings(`
                    <|{

                    }
                `, [{ message: 'illegal character <', file: 'main.css' }]);
            });

            it('should return warning for unknown directive', () => {
                expectWarnings(`
                    .gaga{
                        |-st-something|:true;
                    }
                `, [{ message: 'unknown directive "-st-something"', file: 'main.css' }]);
            });
        });
        describe('pseudo selectors', () => {
            xit('should return warning for native pseudo elements without selector', () => {
                expectWarnings(`
                    |::before|{

                    }
                `, [{
                        message: 'global pseudo elements are not allowed, you can use ".root::before" instead',
                        file: 'main.css'
                    }]);
            });

            describe('elements', () => {
                it('should return a warning for an unknown pseudo element', () => {
                    const config = {
                        entry: '/main.css',
                        files: {
                            '/main.css': {
                                content: `
                                |.root::$myBtn$|{

                                }`
                            }
                        }
                    };
                    expectWarningsFromTransform(
                        config,
                        [{message: 'unknown pseudo element "myBtn"', file: '/main.css'}]
                    );
                });
                nativePseudoElements.forEach(nativeElement => {
                    it(`should not return a warning for native ${nativeElement} pseudo element`, () => {
                        const selector = `|.root::$${nativeElement}$|{`;
                        const config = {
                            entry: '/main.css',
                            files: {
                                '/main.css': {
                                    content: `
                                    ${selector}
                                    }`
                                }
                            }
                        };
                        expectWarningsFromTransform(config, []);
                    });
                });
            });
        });
    });

    describe('structure', () => {

        describe('root', () => {
            it('should return warning for ".root" after selector', () => {
                expectWarnings(`
                    |.gaga .root|{}
                `, [{ message: '.root class cannot be used after spacing', file: 'main.css' }]);
            });
        });

        describe('-st-mixin', () => {
            it('should return warning for unknown mixin', () => {
                expectWarnings(`
                    .gaga{
                        |-st-mixin: $myMixin$|;
                    }
                `, [{ message: 'unknown mixin: "myMixin"', file: 'main.css' }]);
            });

            it('should add error when can not append css mixins', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import {
                                -st-from: "./imported.st.css";
                                |-st-named: $my-mixin$;|
                            }
                            .container {
                                -st-mixin: my-mixin;
                            }
                            `
                        },
                        '/imported.st.css': {
                            content: ``
                        }
                    }
                };
                expectWarningsFromTransform(config, [{ message: 'import mixin does not exist', file: '/main.css' }]);
            });
            it('should add diagnostics when there is a bug in mixin', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import {
                                -st-from: "./imported.js";
                                -st-default: myMixin;
                            }
                            |.container {
                                -st-mixin: $myMixin$;
                            }|
                            `
                        },
                        '/imported.js': {
                            content: `
                                module.exports = function(){
                                    throw 'bug in mixin'
                                }
                            `
                        }
                    }
                };
                expectWarningsFromTransform(config,
                    [{ message: 'could not apply mixin: bug in mixin', file: '/main.css' }]);
            });

            it('js mixin must be a function', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import {
                                -st-from: "./imported.js";
                                -st-named: myMixin;
                            }
                            |.container {
                                -st-mixin: $myMixin$;
                            }|
                            `
                        },
                        '/imported.js': {
                            content: `

                            `
                        }
                    }
                };
                expectWarningsFromTransform(config, [{ message: 'js mixin must be a function', file: '/main.css' }]);
            });
            it('should add diagnostics when declartion is invalid', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import {
                                -st-from: "./imported.js";
                                -st-default: myMixin;
                            }
                            .container {
                                |-st-mixin: $myMixin$|;
                            }
                            `
                        },
                        '/imported.js': {
                            content: `
                                module.exports = function(){
                                    return {
                                        color: true
                                    }
                                }
                            `
                        }
                    }
                };
                expectWarningsFromTransform(config,
                    [{ message: 'not a valid mixin declaration myMixin', file: '/main.css' }]);
            });

            it('should add diagnostics when declartion is invalid (rule)', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import {
                                -st-from: "./imported.js";
                                -st-default: myMixin;
                            }
                            .container {
                                |-st-mixin: $myMixin$|;
                            }
                            `
                        },
                        '/imported.js': {
                            content: `
                                module.exports = function(){
                                    return {
                                        '.x':{
                                            color:true
                                        }
                                    }
                                }
                            `
                        }
                    }
                };
                expectWarningsFromTransform(config,
                    [{ message: `not a valid mixin declaration 'color', and was removed`, file: '/main.css' }]);
            });
            it('should not add warning when mixin value is a string', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import {
                                -st-from: "./imported.js";
                                -st-default: myMixin;
                            }
                            .container {
                                |-st-mixin: $"myMixin"$|;
                            }
                            `
                        },
                        '/imported.js': {
                            content: ``
                        }
                    }
                };
                expectWarningsFromTransform(config,
                    [{ message: 'value can not be a string (remove quotes?)', file: '/main.css' }]);
            });
        });

        describe(':vars', () => {
            it('should return warning when defined in a complex selector', () => {
                expectWarnings(`
                |.gaga:vars|{
                    myColor:red;
                }

                `, [{ message: 'cannot define ":vars" inside a complex selector', file: 'main.css' }]);
            });
        });

        xdescribe('-st-variant', () => {
            it('should return warning when defining variant in complex selector', () => {
                expectWarnings(`
                    .gaga:hover{
                        |-st-variant|:true;
                    }
                `, [{ message: 'cannot define "-st-variant" inside complex selector', file: 'main.css' }]);
            });

            it('should return warning when -st-variant value is not true or false', () => {
                expectWarnings(`
                    .gaga {
                        -st-variant:|red|;
                    }
                `,
                [{ message: '-st-variant can only be true or false, the value "red" is illegal', file: 'main.css' }]);
            });
        });

        describe(':import', () => {
            it('should return warning when defined in a complex selector', () => {
                expectWarnings(`
                    |.gaga:import|{
                        -st-from:"./file";
                        -st-default:Theme;
                    }
                `, [{ message: 'cannot define ":import" inside a complex selector', file: 'main.css' }]);
            });
            it('should return warning for non import rules inside imports', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import{
                                -st-from:"./file.css";
                                -st-default:Comp;
                                |$color$:red;|
                            }
                          `
                        },
                        'file.css': {
                            content: customButton
                        }
                    }
                };
                expectWarningsFromTransform(config,
                    [{ message: `'color' css attribute cannot be used inside :import block`, file: '/main.css' }]);
            });

            it('should return warning for import with missing "from"', () => {
                expectWarnings(`

                    |:import{
                        -st-default:Comp;
                    }
                `, [{ message: `'-st-from' is missing in :import block`, file: 'main.css' }]
                );

            });

        });

        describe('-st-extends', () => {
            it('should return warning when defined under complex selector', () => {
                expectWarnings(`
                    :import{
                        -st-from:"./file";
                        -st-default:Comp;
                    }
                    .root:hover{
                        |-st-extends|:Comp;
                    }
                `, [{ message: 'cannot define "-st-extends" inside a complex selector', file: 'main.css' }]
                );

            });

            it('Only import of type class can be used to extend', () => {
                const config = {
                    entry: '/main.st.css',
                    files: {
                        '/main.st.css': {
                            content: `
                            :import {
                                -st-from: './file.st.css';
                                -st-named: special;
                            }
                            .myclass {
                                |-st-extends: $special$|;
                            }
                            `
                        },
                        '/file.st.css': {
                            content: `
                                :vars {
                                    special: red
                                }
                            `
                        }
                    }
                };
                expectWarningsFromTransform(config, [{ message: 'import is not extendable', file: '/main.st.css' }]);
            });
            it('should warn if extends by js import', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import {
                                -st-from: './file.js';
                                -st-default: special;
                            }
                            .myclass {
                                |-st-extends: $special$|
                            }
                            `
                        },
                        '/file.js': {
                            content: ``
                        }
                    }
                };
                expectWarningsFromTransform(config, [{ message: 'JS import is not extendable', file: '/main.css' }]);
            });
            it('should warn if named extends does not exist', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import {
                                -st-from: './file.st.css';
                                |-st-named: $special$;|
                            }
                            .myclass {
                                -st-extends: special;
                            }
                            `
                        },
                        '/file.st.css': {
                            content: `
                                .notSpecial {
                                    color: red;
                                }
                            `
                        }
                    }
                };
                expectWarningsFromTransform(config, [{ message: `Could not resolve 'special'`, file: '/main.css' }]);
            });
            it('should warn if file not found', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import {
                                |-st-from: $'./file.css'$|;
                                -st-default: special;
                            }
                            .myclass {
                                -st-extends: special
                            }
                            `
                        }
                    }
                };
                expectWarningsFromTransform(config,
                    [{ message: `Imported file '${resolve('/file.css')}' not found`, file: '/main.css' }]);
            });
        });

        describe('override -st-* warnings', () => {

            it('should warn on typed class extend override', () => {
                expectWarnings(`
                    :import {
                        -st-from : './file.css';
                        -st-default: Comp;
                    }
                    .root {
                        -st-extends: Comp;
                    }
                    .root {
                        |-st-extends: Comp;|
                    }
                `, [{ message: 'override "-st-extends" on typed rule "root"', file: 'main.css' }]);
            });
        });
    });

    describe('redeclare symbols', () => {
        it('should warn override mixin on same rule', () => {
            const config = {
                entry: '/main.css',
                files: {
                    '/main.css': {
                        content: `
                        .a {}
                        .b {
                            -st-mixin: a;
                            |-st-mixin: a|;
                        }
                      `
                    },
                    'file.css': {
                        content: customButton
                    }
                }
            };
            expectWarningsFromTransform(config, [{ message: 'override mixin on same rule', file: '/main.css' }]);
        });

        describe('from import', () => {
            it('should warn for unknown import', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import{
                                -st-from:"./import.css";
                                |-st-named: shlomo, $momo$;|
                            }
                            .myClass {
                                -st-extends: shlomo;
                            }
                            .myClass1 {
                                -st-extends: momo;
                            }
                          `
                        },
                        '/import.css': {
                            content: `
                                .shlomo {
                                    color: red
                                }
                            `
                        }
                    }
                };
                expectWarningsFromTransform(config, [{ message: `Could not resolve 'momo'`, file: '/main.css' }]);
            });

            it('should warn when import redeclare same symbol (in same block)', () => {
                expectWarnings(`
                    |:import {
                        -st-from: './file.css';
                        -st-default: name;
                        -st-named: $name$;
                    }
                `, [{ message: 'redeclare symbol "name"', file: 'main.css' }]);
            });

            it('should warn when import redeclare same symbol (in different block)', () => {
                expectWarnings(`
                    :import {
                        -st-from: './file.css';
                        -st-default: name;
                    }
                    |:import {
                        -st-from: './file.css';
                        -st-default: $name$;
                    }
                `, [{ message: 'redeclare symbol "name"', file: 'main.css' }]);
            });

            it('should warn when import redeclare same symbol (in different block types)', () => {
                expectWarnings(`
                    :import {
                        -st-from: './file.css';
                        -st-default: name;
                    }
                    :vars {
                        |$name$: red;
                    }
                `, [{ message: 'redeclare symbol "name"', file: 'main.css' }]);
            });

        });

    });

    describe('complex examples', () => {
        describe(':import', () => {
            it('should return warning for unknown var import', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import{
                                -st-from:"./file.css";
                                -st-default:Comp;
                                |-st-named:$myVar$|;
                            }
                            .root {
                                color:value(myVar);
                            }`
                        },
                        '/file.css': {
                            content: customButton
                        }
                    }
                };
                expectWarningsFromTransform(config,
                    [{ message: `cannot find export 'myVar' in './file.css'`, file: '/main.css' }]);

            });

        });
        describe('cross variance', () => {

            it('stylesheet cannot be used as mixin', () => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            :import{
                                -st-from:"./file.css";
                                |-st-default:$Comp$|;
                            }
                            .root{
                                -st-mixin:Comp;
                            }
                          `
                        },
                        '/file.css': {
                            content: customButton
                        }
                    }
                };
                expectWarningsFromTransform(config,
                    [{ message: `'Comp' is a stylesheet and cannot be used as a mixin`, file: '/main.css' }]);
            });

            xit('component variant cannot be used for native node', () => {
                expectWarnings(`
                    :import{
                        -st-from:"./file";
                        -st-default:Comp;
                        -st-named:my-variant;
                    }

                    .gaga{
                        -st-mixin:|my-variant|;
                    }
                `, [{
                        // tslint:disable-next-line:max-line-length
                        message: '"my-variant" cannot be applied to ".gaga", ".gaga" refers to a native node and "my-variant" can only be spplied to "$namespace of comp"',
                        file: 'main.css'
                    }]
                );

            });

            xit('variants can only be used for a specific component', () => {
                expectWarnings(`
                    :import{
                        -st-from:"./file";
                        -st-default:Comp;
                        -st-named:my-variant;
                    }
                    :import{
                        -st-from:"./file2";
                        -st-default:Comp2;
                        -st-named:my-variant2;
                    }
                    .gaga{
                        -st-extends:Comp;
                        -st-apply:|my-variant2|;
                    }
                `, [{
                        // tslint:disable-next-line:max-line-length
                        message: '"my-variant2" cannot be applied to ".gaga", ".gaga" refers to "$namespace of comp" and "my-variant" can only be spplied to "$namespace of Comp2"',
                        file: 'main.css'
                    }]
                );

            });

            xit('variant cannot be used with params', () => {
                expectWarnings(`
                    :import{
                        -st-from:"./file";
                        -st-default:Comp;
                        -st-named:my-variant;
                    }
                    .root{
                        -st-extend:Comp;
                        -st-mixin:|my-variant(param)|;
                    }
                `, [{
                        message: 'invalid mixin arguments: "my-variant" is a variant and does not accept arguments',
                        file: 'main.css'
                    }]);

            });

        });

    });

    describe('selectors', () => {
        // TODO2: next phase
        xit('should not allow conflicting extends', () => {
            expectWarnings(`
                :import {
                    -st-from: "./sheetA";
                    -st-named: SheetA;
                }
                :import {
                    -st-from: "./sheetB";
                    -st-named: SheetB;
                }
                .my-a { -st-extends: SheetA }
                .my-b { -st-extends: SheetB }

                .my-a.my-b {}
                SheetA.my-b {}
                SheetB.my-a {}
            `, [
                    { message: 'conflicting extends matching same target [.my-a.my-b]', file: 'main.css' },
                    { message: 'conflicting extends matching same target [SheetA.my-b]', file: 'main.css' },
                    { message: 'conflicting extends matching same target [SheetB.my-a]', file: 'main.css' }
                ]
            );
        });

    });

    describe('transforms', () => {
        it('should return warning if @keyframe symbol is used', () => {
            const config = {
                entry: '/main.css',
                files: {
                    '/main.css': {
                        content: `
                        .name {}
                        |@keyframes $name$| {
                            from {}
                            to {}
                        }`
                    }
                }
            };
            expectWarningsFromTransform(config, [{ message: 'symbol name is already in use', file: '/main.css' }]);
        });

        it('should not allow @keyframe of reserved words', () => {
            reservedKeyFrames.map(key => {
                const config = {
                    entry: '/main.css',
                    files: {
                        '/main.css': {
                            content: `
                            |@keyframes $${key}$| {
                                from {}
                                to {}
                            }`
                        }
                    }
                };
                expectWarningsFromTransform(config, [{ message: `keyframes ${key} is reserved`, file: '/main.css' }]);
            });
        });

        it('should return error when trying to import theme from js', () => {
            const config = {
                entry: '/main.css',
                files: {
                    '/main.css': {
                        content: `
                        :import {
                            -st-theme: true;
                            |-st-from: $"./file.js"$|;
                        }
                        `
                    },
                    '/file.js': {
                        content: ``
                    }
                }
            };
            expectWarningsFromTransform(config, [{ message: 'Trying to import unknown file', file: '/main.css' }]);
        });

        it('should error on unresolved alias', () => {
            const config = {
                entry: '/main.st.css',
                files: {
                    '/main.st.css': {
                        namespace: 'entry',
                        content: `
                            |:import{
                                -st-from: "./imported.st.css";
                                -st-default: Imported;
                                -st-named: $inner-class$;
                            }|

                            .Imported{}
                            .inner-class{}
                        `
                    },
                    '/imported.st.css': {
                        namespace: 'imported',
                        content: `.root{}`
                    }
                }
            };
            expectWarningsFromTransform(config, [{ message: 'Trying to import unknown alias', file: '/main.st.css' }]);
        });

        it('should not add warning when compose value is a string', () => {
            const config = {
                entry: '/main.css',
                files: {
                    '/main.css': {
                        content: `
                        :import {
                            -st-from: "./imported.css";
                            -st-default: myCompose;
                        }
                        .container {
                            |-st-compose: $"myCompose"$|;
                        }
                        `
                    },
                    '/imported.css': {
                        content: ``
                    }
                }
            };
            expectWarningsFromTransform(config,
                [{ message: 'value can not be a string (remove quotes?)', file: '/main.css' }]);
        });
    });
});
