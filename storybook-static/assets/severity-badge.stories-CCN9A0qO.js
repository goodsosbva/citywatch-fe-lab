import{i as e}from"./preload-helper-BdFrVu1K.js";import{t}from"./jsx-runtime-f3rHp9ZU.js";import{n,t as r}from"./badge-Cs5YhrRx.js";function i({severity:e}){return(0,a.jsx)(r,{tone:o[e],children:s[e]})}var a,o,s,c=e((()=>{n(),a=t(),o={low:`info`,medium:`warning`,high:`danger`,critical:`danger`},s={low:`Low`,medium:`Medium`,high:`High`,critical:`Critical`},i.__docgenInfo={description:``,methods:[],displayName:`SeverityBadge`,props:{severity:{required:!0,tsType:{name:`IncidentSeverity`},description:``}}}})),l,u,d,f,p;e((()=>{c(),l=t(),u={title:`Shared UI/SeverityBadge`,component:i,args:{severity:`medium`},argTypes:{severity:{control:`inline-radio`,options:[`low`,`medium`,`high`,`critical`]}}},d={},f={render:()=>(0,l.jsxs)(`div`,{style:{display:`flex`,gap:`0.75rem`,flexWrap:`wrap`},children:[(0,l.jsx)(i,{severity:`low`}),(0,l.jsx)(i,{severity:`medium`}),(0,l.jsx)(i,{severity:`high`}),(0,l.jsx)(i,{severity:`critical`})]})},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  render: () => <div style={{
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap"
  }}>\r
      <SeverityBadge severity="low" />\r
      <SeverityBadge severity="medium" />\r
      <SeverityBadge severity="high" />\r
      <SeverityBadge severity="critical" />\r
    </div>
}`,...f.parameters?.docs?.source}}},p=[`Playground`,`AllSeverities`]}))();export{f as AllSeverities,d as Playground,p as __namedExportsOrder,u as default};