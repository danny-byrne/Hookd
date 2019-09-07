import {t} from './parser';
import {Path, stateDep, handlers} from './interfaces';
import {createFunctionDefinitions, checkKeyIdentifier, parseStateDep, checkIfHandler, makeUseStateNode, setStateToHooks, stateToHooks, thisRemover, buildStateDepTree} from '../helperfunctions';
import * as n from './names';
import { unstable_renderSubtreeIntoContainer } from 'react-dom';

const DeclarationStore: string[] = [];
let isAComponent: boolean = true;
export const ImpSpecVisitor: {ImportSpecifier: (path: Path)=> void} ={
  // method for traversing through all the ImportSpecifiers
  ImportSpecifier(path: Path): void {
    // check to see if the property 'imported' is an identifier with the name 'Component'
    if (path.get('imported').isIdentifier({name: 'Component'})) {
      // replace the current path (importSpecifier) with multiple new importSpcefiers
      path.replaceWithMultiple([
        t.importSpecifier(t.identifier(n.US), t.identifier(n.US)),
        t.importSpecifier(t.identifier(n.UE), t.identifier(n.UE)),
        t.importSpecifier(t.identifier(n.UC), t.identifier(n.UC)),
      ]);
    }
  }
}

export const ImpDeclVisitor: {ImportDeclaration: (path: Path) => void} = { 
  ImportDeclaration(path: Path): void {
    if (!isAComponent) return path.stop();
    path.traverse(ImpSpecVisitor)
    // console.log('inside the import declaration, pushing those values into DeclStoreArray to check against the context consumers')
    // console.log('ImportDeclaration path is', path.node)
    path.traverse({
      ImportDefaultSpecifier (path: Path): void {
        // console.log('inside path traversal of importDefaultSpecifier')
        // console.log('ImportDefaultSpecifier path is:', path.node)
        DeclarationStore.push(path.node.local.name);
      }
    })
  }
}


export const memberExpVisitor: object = {
  MemberExpression(path: Path): void{
    if (!isAComponent) return path.stop();
    if(path.node.property.name === 'setState'){
      // console.log(`yee i'm inside of member expression`)
      setStateToHooks(path.parentPath as Path);
    } else if (path.node.property.name === 'state' && t.isThisExpression(path.node.object)){
      // console.log('gon change some state: ', path.node);
      stateToHooks(path.parentPath as Path);
    } else {
      thisRemover(path as Path);
    }
  }
}

export const classDeclarationVisitor: {ClassDeclaration: (path: Path) => void} = {
  ClassDeclaration(path: Path): void {
    isAComponent = path.node.superClass && (path.get('superClass').isIdentifier({name: 'Component'}) || path.get('superClass').get('property').isIdentifier({name: 'Component'}));
    // console.log('isAComponent:', isAComponent);
    if (!isAComponent) return path.stop();
    // class declaration
    let componentName: string = path.get('id').node.name;
    // useState
    const useStateData: any[] = [];
    let possibleProps: string = '()';
    // useContext
    let contextToUse: string = '';
    // useEffect
    const methodPaths: any[] = [];
    // handlers referencing state
    const handlers: handlers[] = [];
    // dependency tree of state
    const stateDependencies: stateDep = {};

    
    let isStatic: boolean = false;
    let isContext: boolean = false;
    let objectPattern: any;
    let returnStatement: any;


    path.traverse({
      ClassProperty(path: Path): void {
        // console.log("path.node is:", path.node)
        // console.log("static is:", path.node.static)
        // console.log("path.value.name is:", path.node.value.name)
        if(path.node.static) { 
          console.log('static found')
          isStatic = true;
        }
        if (!isStatic) path.stop();
        // console.log('isStatic is:', isStatic);
        contextToUse = path.node.value.name;
        // console.log("contextToUse is", contextToUse)
        // path.remove();
      }
    })

    /**
     * //this method looks for a static contextType = ${importedCntext} statement and grabs the context declared, and also looks for a 'this.context' expression within the render, if found, it grabs the Object pattern that we will use to combine and destructure from useContext(imported context) in the next step useContext(contextToUse)  <- new context name we have given to the variableDeclarator
     */
    
    if(isStatic){
      path.traverse({
        ClassMethod(path: Path): void {
          // console.log("inside the ClassMethod path.node is:", path.node);
          path.traverse({
            BlockStatement(path: Path): void {
              console.log('inside the blockStatement path.node is:', path.node)
              // let curPath: { body: any[]; } = path.node.body;
              // console.log('curPath is ', curPath);
              path.traverse({
                VariableDeclaration(path: Path): void {
                  // console.log("inside the VariableDeclaration path.node is:", path.node);
                  path.traverse({
                    VariableDeclarator(path: Path): void {
                      // console.log("inside the VariableDeclarator path.node is", path.node);
                      path.traverse({
                        MemberExpression(path: Path): void {
                          // console.log("inside the MemberExpression path.node is", path.node);
                          // console.log("path.node.property.name is", path.node.property.name)
                          // console.log(path.node.property.name === "context")
                          if(path.node.property.name === "context"){
                            isContext = true;
                            console.log(isContext);
                          }
                        }
                      })
                      if(isContext){
                        // console.log("path.node.id is", path.node.id.type)
                        if(path.node.id.type === "ObjectPattern"){
                          // console.log('grabbing objectPattern')
                          objectPattern = path.node.id;
                          // console.log('path.parentPath.node.type is ', path.parentPath.node.type)
                          // console.log('objectPattern is', objectPattern)
                          path.parentPath.remove();
                        }
                      }  
                    }
                  })
                }
              })
              if(isStatic && isContext){
                path.traverse({
                  ReturnStatement(path :Path): void {
                    // console.log('traversing return statement, path.node is', path.node)
                    returnStatement = path.node;
                  }
                })
              }
            }
          })
          path.traverse({
            BlockStatement(path: Path): void {
              // path.traverse({
                // VariableDeclaration(path: Path): void {
                  // console.log('going to push returnStatement which is:', returnStatement)
                  // console.log('the path we are in is:', path.node)
                  // path.node.body.push(returnStatement)
                  
              //   }
              // })
            }
          })
        }
      })
    }

    /**
     * this method only fires if we have found a static declaration, this.context is used within the render, traverses to the  classProperty node, looks for static, and if is found, replaces with the const declaration with the Object pattern and useContext with contextToUse passed in as the arg
     */
    
    if(isStatic && isContext && objectPattern){
      // console.log('replacing the classProperty with useContext')
      // console.log('objectpattern is', objectPattern)
      path.traverse({
        ClassProperty(path: Path): void {
          if(path.node.static) { 
            // console.log('static found! replacing with useContext Statement')
            // console.log('path.node is', path.node)
            path.replaceWith(
              t.variableDeclaration("const",
                [t.variableDeclarator(objectPattern,
                  t.callExpression(
                    t.identifier('useContext'),[
                      t.identifier(`${contextToUse}`)
                    ]
                  )
                )]
              )
            )
          }
        }
      })
        
          
      // path.traverse({
      //   ReturnStatement(Path: Path): void {
      //     console.log('about to get the return statement, yee haw!')
      //     returnStatement = path.node;
      //     console.log("returnStatement is", returnStatement)
      //   }
      // })
    }


    path.traverse({
      ClassMethod(path: Path): void {
        let currMethodName = path.node.key.name;
        const cdm = checkKeyIdentifier(n.CDM, path),
        cdu = checkKeyIdentifier(n.CDU, path),
        cwu = checkKeyIdentifier(n.CWU, path),
        render = checkKeyIdentifier(n.R, path),
        constructor = checkKeyIdentifier(n.C, path);
        // traverse through all expression statements and function declarations within a classMethod
        path.traverse({
          ExpressionStatement(path: Path): void {
            let expressionStatement: any = path.node;
            let functionDeclaration: any;
            if (path.parentPath.parentPath.node.type === 'FunctionDeclaration'){
              // console.log('----------------')
              // console.log(path.parentPath.parentPath.node.id.name);
              functionDeclaration = path.parentPath.parentPath.node;
            }
            path.traverse({
              MemberExpression(path: Path): void {
                const stateName: string = path.parentPath.node.property ? path.parentPath.node.property.name : null;
                let isHandler = checkIfHandler(currMethodName);
                if (!isHandler) {
                  if (functionDeclaration) expressionStatement = functionDeclaration;
                  if (t.isIdentifier(path.node.property, {name: 'state'}) && stateName) {
                    buildStateDepTree(currMethodName, expressionStatement, stateDependencies, stateName, false);
                    // console.log(stateDependencies);
                  }
                  if(t.isIdentifier(path.node.property, {name: 'setState'})) {
                    const stateProperties: any[] = path.parentPath.node.arguments[0].properties;
                    stateProperties.forEach(property => {
                      const setStateName: string = property.key.name;
                      buildStateDepTree(currMethodName, expressionStatement, stateDependencies, setStateName, true);
                    })
                  }
                }
              
              }
            })
          }
        })
         // look specifically for the constructor method, where all the state is held
         let stateArr: any[];
         if(constructor){
          // console.log('the path.node of ClassMethod: ', path.node)
          possibleProps = path.get('params')[0].node.name;
          path.traverse({
            // since constructor exists, state or method bindings should exist(?)
            AssignmentExpression(path: Path): void{
              if (t.isExpression(path.node, {operator: '='})) {
                if(t.isIdentifier(path.get('left').node.property, {name: 'state'})) {
                  // in an Assignment Expression, there will be a left and a right
                  // left will be what is the label/key and right will be the value(s) of what's being assigned
                  // we keep the value(s) in a variable. it will be an array.
                  stateArr = path.get('right').node.properties;
                }
              }
            }
          })
          useStateData.push(path, stateArr);
        } 
        if (!cdm && !cdu && !cwu && !render && !constructor) {
          let name: string = path.node.key.name ? path.node.key.name : '';
          let paramNames: any[] = path.node.params;
          let body: any[] = path.node.body.body;
          // console.log(path.node);
          methodPaths.push([createFunctionDefinitions(name, paramNames, body), path]) 
          handlers.push({node: path.node, name, setsState: false});
        }
        if(cdm) path.remove();
        if(cdu) path.remove();
        if(cwu) path.remove();
        if(render) {
          // console.log("path.node.body.body is:", path.node.body.body)
          path.replaceWithMultiple(path.node.body.body);
          
        } 
     }
    })
    methodPaths.forEach(arr => {
      arr[1].replaceWith(arr[0])
    })
    // need to change position of useEffect so it's after state declarations
    parseStateDep(stateDependencies).forEach(UE => {
      path.get('body').unshiftContainer('body', UE);
    })
    // prepends 'const [state, setState] = useState(initVal)' outside of the constructor function
    // makeUseStateNode(path as any, state as any);
    makeUseStateNode(useStateData[0] as any, useStateData[1] as any).forEach(stateNode => path.get('body').unshiftContainer('body', stateNode))
    path.traverse({
      JSXElement(path: Path): void {
        path.traverse({
          JSXMemberExpression(path: Path): void {
              //if right side of expression is "consumer", grab the value on the left side of the dot to constuct the useContext statement
            if(path.node.property.name.toLowerCase() === 'consumer'){
              // console.group('match found');
              // if DeclarationStore includes left side expession
              if(DeclarationStore.includes(path.node.object.name)){
                contextToUse = path.node.object.name;
                // console.log(contextToUse);
                // console.log('context is found and contextToUse is', contextToUse);
              }
            }
            if(path.node.object.name === contextToUse){
              // console.log ('found a match!!')
              path.replaceWith(
                t.jSXMemberExpression(t.jSXIdentifier('React'), t.jSXIdentifier('Fragment'))
              )
            }
          }
        })
        path.traverse({
          JSXExpressionContainer(path: Path): void {
            let importedContext: string = 'imported' + contextToUse;
            path.traverse({
              ArrowFunctionExpression(path: Path): void{
                path.replaceWith(
                  t.ExpressionStatement(
                    t.identifier(`${importedContext}`)
                  )
                )
              }
            })
          }
        })
      }
    })
    //if a static declaration has not been found we will structure the useContext statement this way.
    if(!isStatic){
      path.traverse(memberExpVisitor);
      path.get('body').unshiftContainer('body',
        t.variableDeclaration("const", 
        [t.variableDeclarator(
          t.identifier('imported'+`${contextToUse}`), 
          t.callExpression(t.identifier("useContext"),
          [t.identifier(`${contextToUse}`)]
          )
          )]
        )
      ) 
    }
    path.replaceWith(
      t.variableDeclaration("const", 
      [t.variableDeclarator(
        t.identifier(`${componentName}`), 
        t.arrowFunctionExpression([t.identifier(possibleProps)], t.blockStatement(path.node.body.body)) 
        )
      ])
    )
    }
  }