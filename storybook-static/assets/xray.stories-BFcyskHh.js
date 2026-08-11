import{i as e,s as t}from"./preload-helper-BdFrVu1K.js";import{t as n}from"./iframe-D_Dc52wi.js";import{t as r}from"./jsx-runtime-f3rHp9ZU.js";function i({children:e,className:t,enabled:n=!1,label:r,layer:i,packageName:a,proofs:u=[`fsd-style`],stacks:d=[],style:f,title:p,...m}){if(!n)return(0,l.jsx)(l.Fragment,{children:e});let h=i??o(r);return(0,l.jsxs)(`div`,{className:[`cw-xray-box`,t].filter(Boolean).join(` `),"data-xray-layer":h,"data-xray-label":r,"data-xray-package":a,"data-xray-proofs":u.join(` `),"data-xray-stacks":d.join(`,`),style:f,title:p??c(r,a,d),...m,children:[(0,l.jsx)(`span`,{className:`cw-xray-label`,children:s(r)}),e]})}function a({enabled:e,label:t=`X-Ray`,onChange:n,style:r}){return(0,l.jsxs)(`button`,{"aria-label":`${t} mode`,"aria-pressed":e,className:`cw-xray-toggle`,onClick:()=>n(!e),style:r,type:`button`,children:[t,`: `,e?`On`:`Off`]})}function o(e){let t=e.split(`/`)[0];return u.includes(t)?t:`shared`}function s(e){let t=e.split(`/`),n=t[0],r=t[t.length-1];return n&&r&&n!==r?`${n}/${r}`:e}function c(e,t,n=[]){return[e,t,n.length?n.join(` · `):void 0].filter(Boolean).join(`
`)}var l,u,d=e((()=>{l=r(),u=[`app`,`widget`,`feature`,`entity`,`shared`,`remote`,`package`],i.__docgenInfo={description:``,methods:[],displayName:`XRayBox`,props:{children:{required:!0,tsType:{name:`ReactNode`},description:``},enabled:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`false`,computed:!1}},label:{required:!0,tsType:{name:`string`},description:``},layer:{required:!1,tsType:{name:`union`,raw:`"app" | "widget" | "feature" | "entity" | "shared" | "remote" | "package"`,elements:[{name:`literal`,value:`"app"`},{name:`literal`,value:`"widget"`},{name:`literal`,value:`"feature"`},{name:`literal`,value:`"entity"`},{name:`literal`,value:`"shared"`},{name:`literal`,value:`"remote"`},{name:`literal`,value:`"package"`}]},description:``},packageName:{required:!1,tsType:{name:`string`},description:``},proofs:{required:!1,tsType:{name:`Array`,elements:[{name:`string`}],raw:`string[]`},description:``,defaultValue:{value:`["fsd-style"]`,computed:!1}},stacks:{required:!1,tsType:{name:`Array`,elements:[{name:`string`}],raw:`string[]`},description:``,defaultValue:{value:`[]`,computed:!1}}}},a.__docgenInfo={description:``,methods:[],displayName:`XRayToggle`,props:{enabled:{required:!0,tsType:{name:`boolean`},description:``},onChange:{required:!0,tsType:{name:`signature`,type:`function`,raw:`(enabled: boolean) => void`,signature:{arguments:[{type:{name:`boolean`},name:`enabled`}],return:{name:`void`}}},description:``},label:{required:!1,tsType:{name:`string`},description:``,defaultValue:{value:`"X-Ray"`,computed:!1}},style:{required:!1,tsType:{name:`CSSProperties`},description:``}}}})),f,p,m,h,g,_,v,y,b,x;e((()=>{f=t(n(),1),d(),p=r(),{expect:m,userEvent:h,within:g}=__STORYBOOK_MODULE_TEST__,_={title:`Shared UI/XRay`},v={render:()=>(0,p.jsxs)(`div`,{style:{display:`grid`,gap:`1rem`,maxWidth:`32rem`,width:`100%`},children:[(0,p.jsx)(i,{enabled:!0,label:`app/dashboard/HomePage`,layer:`app`,children:(0,p.jsx)(`div`,{style:b,children:`app/dashboard/HomePage`})}),(0,p.jsx)(i,{enabled:!0,label:`feature/incident/FetchIncidentList`,layer:`feature`,children:(0,p.jsx)(`div`,{style:b,children:`feature/incident/FetchIncidentList`})}),(0,p.jsx)(i,{enabled:!0,label:`shared/ui/SeverityBadge`,layer:`shared`,children:(0,p.jsx)(`div`,{style:b,children:`shared/ui/SeverityBadge`})})]})},y={render:()=>{function e(){let[e,t]=(0,f.useState)(!1);return(0,p.jsxs)(`div`,{style:{display:`grid`,gap:`1rem`,maxWidth:`32rem`},children:[(0,p.jsx)(a,{enabled:e,onChange:t}),(0,p.jsx)(i,{enabled:e,label:`widget/incident/IncidentSummaryCard`,layer:`widget`,packageName:`@citywatch/ui`,stacks:[`React`,`TypeScript`,`Storybook`],children:(0,p.jsx)(`div`,{style:b,children:`Toggle the overlay to inspect this block.`})})]})}return(0,p.jsx)(e,{})},play:async({canvasElement:e})=>{let t=g(e).getByRole(`button`,{name:`X-Ray mode`});m(t).toHaveAttribute(`aria-pressed`,`false`),await h.click(t),m(t).toHaveAttribute(`aria-pressed`,`true`),m(e.querySelector(`[data-xray-label="widget/incident/IncidentSummaryCard"]`)).toHaveAttribute(`data-xray-proofs`,`fsd-style`)}},b={background:`#f8fafc`,border:`1px solid #cbd5e1`,borderRadius:`12px`,color:`#0f172a`,fontWeight:700,minHeight:`96px`,padding:`1rem`},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  render: () => <div style={{
    display: "grid",
    gap: "1rem",
    maxWidth: "32rem",
    width: "100%"
  }}>\r
      <XRayBox enabled label="app/dashboard/HomePage" layer="app">\r
        <div style={panelStyle}>app/dashboard/HomePage</div>\r
      </XRayBox>\r
      <XRayBox enabled label="feature/incident/FetchIncidentList" layer="feature">\r
        <div style={panelStyle}>feature/incident/FetchIncidentList</div>\r
      </XRayBox>\r
      <XRayBox enabled label="shared/ui/SeverityBadge" layer="shared">\r
        <div style={panelStyle}>shared/ui/SeverityBadge</div>\r
      </XRayBox>\r
    </div>
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  render: () => {
    function Demo() {
      const [enabled, setEnabled] = useState(false);
      return <div style={{
        display: "grid",
        gap: "1rem",
        maxWidth: "32rem"
      }}>\r
          <XRayToggle enabled={enabled} onChange={setEnabled} />\r
          <XRayBox enabled={enabled} label="widget/incident/IncidentSummaryCard" layer="widget" packageName="@citywatch/ui" stacks={["React", "TypeScript", "Storybook"]}>\r
            <div style={panelStyle}>\r
              Toggle the overlay to inspect this block.\r
            </div>\r
          </XRayBox>\r
        </div>;
    }
    return <Demo />;
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", {
      name: "X-Ray mode"
    });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(canvasElement.querySelector('[data-xray-label="widget/incident/IncidentSummaryCard"]')).toHaveAttribute("data-xray-proofs", "fsd-style");
  }
}`,...y.parameters?.docs?.source}}},x=[`BoxLayers`,`ToggleDemo`]}))();export{v as BoxLayers,y as ToggleDemo,x as __namedExportsOrder,_ as default};