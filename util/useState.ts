// // create functions in here and export in object
// import * as parserMethods from './constants/parser';
// const { parse, traverse, t, generate } = parserMethods;
// import * as path from 'path';
// import * as fs from 'fs';
// import { Path, Node } from './constants/interfaces';

// // App is now a string with full definition
// const App: string = fs.readFileSync(path.resolve(__dirname as string, '../static/dummyData/app.jsx'), 'utf-8');

// // this logs the file's definition
// // console.log(App);

// // the files gets parsed into an AST (Abstract Syntax Tree)
// let ast: any = parse(App as string);

// // keeping global state for state to keep track of. can be placed in local scope to not have global var
// const classVisitor = {
//   ClassDeclaration(path: Path): void{
//     path.traverse({
//       //traverses into all the Class Methods
//       ClassMethod(path: Path): void{
//         // look specifically for the constructor method, where all the state is held
//         if(path.node.key.name === 'constructor'){
//           let state;
//           // console.log('the path.node of ClassMethod: ', path.node)
//           path.traverse({
//             // since constructor exists, state or method bindings should exist(?)
//             AssignmentExpression(path: Path): void{
//               // console.log('in AssignmentExpression')
//               if (t.isExpression(path.node, {operator: '='})) {
//                 if(t.isIdentifier(path.get('left').node.property, {name: 'state'})) {
//                   // in an Assignment Expression, there will be a left and a right
//                   // left will be what is the label/key and right will be the value(s) of what's being assigned
                  
//                   // console.log(path.node)
                  
//                   // we keep the value(s) in a variable. it will be an array.
//                   // console.log(path.get('right'))
//                   state = path.get('right').node.properties;
//                 }
//               }
//             }
//           })
//           // prepends 'const [state, setState] = useState(initVal)' outside of the constructor function
//           makeUseStateNode(path as any, state as any);
//         } else {
//           // logic to traverse through other class methods go here
//           path.traverse(memberExpVisitor);
//         }
//         // path.remove();
//       }
//     })
//   }
// }

// // visitor to look for Member Expressions and replace this.setState and this.state with equivalent hooks
// const memberExpVisitor: object = {
//   MemberExpression(path: Path): void{
//     if(path.node.property.name === 'setState'){
//       // console.log(path.node.property.name)
//       // console.log(`yee i'm inside of member expression`)
//       setStateToHooks(path.parentPath as Path);
//     } else if (path.node.property.name === 'state' && t.isThisExpression(path.node.object)){
//       // console.log('gon change some state: ', path.node);
//       stateToHooks(path.parentPath as Path);
//     } else {
//       thisRemover(path as Path);
//     }
//   }
// }


// /**
//  * this func will create 'const [state, setState] = useState(initState);' from 'rightObjProps' and insert from 'path'
//  * @param path the path to append siblings to before deletion
//  * @param rightExpr the props array from ObjectExpression which contains the state
//  */
// function makeUseStateNode(path: Path, rightObjProps: any): void {
//   const states = [];
//   // the rightObjProps will be an array
//   for (let i = 0; i < rightObjProps.length; i++){
//     // declare the node itself to make it easier to work with
//     const objExp = rightObjProps[i];
//     // an ObjectExpression will contain a key with a Node type 'Identifier'
//     const key =  objExp.key;
//     // the actual name of the state as a string and not a Node type
//     const keyName = key.name;
//     // an ObjectExpression will contain a value with a Node type of any Expression (another nested Object or any value)
//     const val = objExp.value;
//     // declare an array pattern for the '[state, setState]'
//     const arrPatt = t.arrayPattern([t.identifier(keyName), t.identifier('set' + upFirstChar(keyName))]);
//     // declares 'useState(initVal)'
//     const callExp = t.callExpression(t.identifier('useState'), [val]);
//     // creates '[state, setState] = useState(initVal);'
//     const varDecl = t.variableDeclarator(arrPatt, callExp);
//     // adds 'const [state, setState] = useState(initState);' as a sibling
//     states.push(t.variableDeclaration('const', [varDecl]));
//     // path.insertBefore(t.variableDeclaration('const', [varDecl]))
//   }
//   path.replaceWithMultiple(states);
// }

// /**
//  * replaces this.setState({ state: newState }) with setState(newState)
//  * ALERT -- place function within member expression visitor
//  * @param parentPath exactly what it says
//  */
// function setStateToHooks(parentPath: any): void {
//   // this will be an array of arguments to make setState Call Arguments with
//   const args = parentPath.node.arguments[0].properties
//   const states = [];
//   for (let i = 0; i < args.length; i++){
//     const keyName = args[i].key.name;
//     const call = t.identifier('set' + upFirstChar(keyName))
//     const arg = args[i].value;
//     const callStatement = t.callExpression(call, [arg])
//     const expStatement = t.expressionStatement(callStatement)
//     states.push(expStatement)
//   }
//   parentPath.replaceWithMultiple(states)
// }

// /**
//  * turns 'this.state.example' expressions to 'example'
//  * @param parentPath path.parentPath. this. what it says.
//  */
//   function stateToHooks (parentPath: any): void {
//     if (t.isMemberExpression(parentPath.parentPath.node)) parentPath.parentPath.node.object = parentPath.node.property;
// 	  else parentPath.replaceWith(parentPath.node.property);
//   }

//   /**
//    * will DECIMATE all other this statements no matter what. Used within MemberExpression Visitor
//    * WARNING: will literally destroy any and all 'this' statements
//    * @param path pass in the path of MemberExpression where it will look for anything that has to do with 'this'
//    */
//   function thisRemover(path: any): void {
//     if (t.isThisExpression(path.node.object)){
//       if (t.isMemberExpression(path.node)) path.node.object = path.node.property;
//       if (t.isCallExpression(path.node)) path.node.callee = path.node.property;
//       else path.replaceWith(path.node.property);
//     }
//   }

// /**
//  * this will uppercase the first letter in the string
//  * @param string the string to affect
//  * @returns a string
//  * taken from a website do not steal
//  */
// const upFirstChar = (string: string) => string.charAt(0).toUpperCase() + string.slice(1);

// traverse(ast , {
//   enter(path: any) {
//     path.traverse(classVisitor);
//   }
// })

// // 'original' will be an object with { code: String, map: null, rawMappings: null }
// const original = generate(ast as any);

// fs.writeFileSync('static/dummyData/newFile.jsx', original.code as string);

// module.exports = {}